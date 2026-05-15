"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpayPayment = exports.createRazorpayOrder = exports.validateCoupon = void 0;
const functions = __importStar(require("firebase-functions"));
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const razorpay_1 = __importDefault(require("razorpay"));
const razorpayCoupons_1 = require("./razorpayCoupons");
const razorpayKeyId = (0, params_1.defineSecret)("RAZORPAY_KEY_ID");
const razorpayKeySecret = (0, params_1.defineSecret)("RAZORPAY_KEY_SECRET");
const MIN_STUDENTS = 25;
const MAX_STUDENTS = 50000;
// ── validateCoupon — live UI feedback ────────────────────────────────────────
exports.validateCoupon = functions
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }
    const students = Number(data?.students);
    const coupon = typeof data?.coupon === "string" ? data.coupon : "";
    if (!Number.isFinite(students) || students < MIN_STUDENTS || students > MAX_STUDENTS) {
        throw new functions.https.HttpsError("invalid-argument", `Number of students must be between ${MIN_STUDENTS} and ${MAX_STUDENTS}.`);
    }
    try {
        const price = (0, razorpayCoupons_1.calculatePrice)(students, coupon || null);
        return { ok: true, breakdown: price };
    }
    catch (err) {
        if (err?.code === "invalid-coupon") {
            return { ok: false, message: err.message || "Invalid coupon code." };
        }
        throw new functions.https.HttpsError("internal", err?.message || "Coupon check failed.");
    }
});
// ── createRazorpayOrder ──────────────────────────────────────────────────────
exports.createRazorpayOrder = functions
    .runWith({ secrets: [razorpayKeyId, razorpayKeySecret] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }
    const uid = context.auth.uid;
    const students = Number(data?.students);
    const coupon = typeof data?.coupon === "string" ? data.coupon : null;
    if (!Number.isFinite(students) || students < MIN_STUDENTS || students > MAX_STUDENTS) {
        throw new functions.https.HttpsError("invalid-argument", `Number of students must be between ${MIN_STUDENTS} and ${MAX_STUDENTS}.`);
    }
    // Re-validate the school doc exists + belongs to caller
    const schoolRef = admin.firestore().collection("schools").doc(uid);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
        throw new functions.https.HttpsError("not-found", "School not registered.");
    }
    let breakdown;
    try {
        breakdown = (0, razorpayCoupons_1.calculatePrice)(students, coupon);
    }
    catch (err) {
        if (err?.code === "invalid-coupon") {
            throw new functions.https.HttpsError("invalid-argument", err.message);
        }
        throw err;
    }
    const razorpay = new razorpay_1.default({
        key_id: razorpayKeyId.value(),
        key_secret: razorpayKeySecret.value(),
    });
    const order = await razorpay.orders.create({
        amount: breakdown.totalAmount * 100,
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
exports.verifyRazorpayPayment = functions
    .runWith({ secrets: [razorpayKeySecret] })
    .https.onCall(async (data, context) => {
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
    const order = orderSnap.data();
    if (order.schoolUid !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Order does not belong to caller.");
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
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
//# sourceMappingURL=razorpay.js.map