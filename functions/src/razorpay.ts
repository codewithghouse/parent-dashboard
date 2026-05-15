import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import Razorpay from "razorpay";
import { calculatePrice } from "./razorpayCoupons";

const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");

const MIN_STUDENTS = 25;
const MAX_STUDENTS = 50000;

interface CreateOrderData {
  students?: number;
  coupon?: string | null;
}

interface VerifyData {
  orderId?: string;
  paymentId?: string;
  signature?: string;
}

// ── validateCoupon — live UI feedback ────────────────────────────────────────
export const validateCoupon = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }
    const students = Number(data?.students);
    const coupon = typeof data?.coupon === "string" ? data.coupon : "";

    if (!Number.isFinite(students) || students < MIN_STUDENTS || students > MAX_STUDENTS) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Number of students must be between ${MIN_STUDENTS} and ${MAX_STUDENTS}.`,
      );
    }

    try {
      const price = calculatePrice(students, coupon || null);
      return { ok: true, breakdown: price };
    } catch (err: any) {
      if (err?.code === "invalid-coupon") {
        return { ok: false, message: err.message || "Invalid coupon code." };
      }
      throw new functions.https.HttpsError("internal", err?.message || "Coupon check failed.");
    }
  });

// ── createRazorpayOrder ──────────────────────────────────────────────────────
export const createRazorpayOrder = functions
  .runWith({ secrets: [razorpayKeyId, razorpayKeySecret] })
  .https.onCall(async (data: CreateOrderData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }
    const uid = context.auth.uid;

    const students = Number(data?.students);
    const coupon = typeof data?.coupon === "string" ? data.coupon : null;

    if (!Number.isFinite(students) || students < MIN_STUDENTS || students > MAX_STUDENTS) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Number of students must be between ${MIN_STUDENTS} and ${MAX_STUDENTS}.`,
      );
    }

    // Re-validate the school doc exists + belongs to caller
    const schoolRef = admin.firestore().collection("schools").doc(uid);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
      throw new functions.https.HttpsError("not-found", "School not registered.");
    }

    let breakdown;
    try {
      breakdown = calculatePrice(students, coupon);
    } catch (err: any) {
      if (err?.code === "invalid-coupon") {
        throw new functions.https.HttpsError("invalid-argument", err.message);
      }
      throw err;
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId.value(),
      key_secret: razorpayKeySecret.value(),
    });

    const order = await razorpay.orders.create({
      amount: breakdown.totalAmount * 100, // paise
      currency: "INR",
      receipt: `school_${uid.slice(0, 10)}_${Date.now()}`,
      notes: {
        schoolUid: uid,
        students: String(students),
        coupon: breakdown.appliedCoupon || "",
      },
    });

    await admin.firestore().collection("payment_orders").doc(order.id).set({
      schoolUid: uid,
      razorpayOrderId: order.id,
      students: breakdown.students,
      perStudent: breakdown.perStudent,
      subtotal: breakdown.subtotal,
      discountAmount: breakdown.discountAmount,
      discountLabel: breakdown.discountLabel,
      afterDiscount: breakdown.afterDiscount,
      gstAmount: breakdown.gstAmount,
      totalAmount: breakdown.totalAmount,
      coupon: breakdown.appliedCoupon,
      status: "created",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      orderId: order.id,
      amount: breakdown.totalAmount,
      amountPaise: breakdown.totalAmount * 100,
      currency: "INR",
      keyId: razorpayKeyId.value(),
      breakdown,
    };
  });

// ── verifyRazorpayPayment ────────────────────────────────────────────────────
export const verifyRazorpayPayment = functions
  .runWith({ secrets: [razorpayKeySecret] })
  .https.onCall(async (data: VerifyData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }
    const uid = context.auth.uid;

    const orderId = String(data?.orderId || "");
    const paymentId = String(data?.paymentId || "");
    const signature = String(data?.signature || "");

    if (!orderId || !paymentId || !signature) {
      throw new functions.https.HttpsError("invalid-argument", "Missing Razorpay fields.");
    }

    const expected = crypto
      .createHmac("sha256", razorpayKeySecret.value())
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected !== signature) {
      await admin.firestore().collection("payment_orders").doc(orderId).set({
        status: "signature_failed",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw new functions.https.HttpsError("permission-denied", "Invalid payment signature.");
    }

    const orderRef = admin.firestore().collection("payment_orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Order not found.");
    }
    const order = orderSnap.data()!;
    if (order.schoolUid !== uid) {
      throw new functions.https.HttpsError("permission-denied", "Order does not belong to caller.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    );

    await admin.firestore().collection("schools").doc(uid).set({
      subscriptionStatus: "active",
      paymentStatus: "paid",
      studentCount: order.students,
      pricePerStudent: order.perStudent,
      totalPaid: order.totalAmount,
      couponCode: order.coupon || null,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      activatedAt: now,
      expiresAt,
    }, { merge: true });

    await orderRef.set({
      status: "paid",
      razorpayPaymentId: paymentId,
      paidAt: now,
    }, { merge: true });

    return { success: true };
  });
