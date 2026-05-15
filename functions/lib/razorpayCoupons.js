"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePrice = exports.perStudentPrice = exports.FREE_ACCESS_CODES = void 0;
// 212 dummy launch / early-access coupon codes. Each code reduces the
// final amount to ₹1 (still records a real Razorpay transaction for
// audit) so demo schools can complete the full payment flow end-to-end
// without spending real money in production.
//
// Update: replace this list or move to Firestore when launching for real.
exports.FREE_ACCESS_CODES = new Set([
    "EDUZS", "EDU7T", "EDUT7", "EDU33", "EDU2X", "EDU8G", "EDUDC", "EDU4J", "EDU8A", "EDUCN",
    "EDUW6", "EDUFP", "EDU8E", "EDU7E", "EDUV8", "EDUVH", "EDUF7", "EDUF5", "EDUJ6", "EDUMS",
    "EDU5W", "EDUHZ", "EDUWH", "EDUDQ", "EDU9T", "EDUVK", "EDUBF", "EDUMC", "EDUBE", "EDUCD",
    "EDU9K", "EDUKG", "EDUJZ", "EDUH6", "EDUBZ", "EDUGH", "EDU4E", "EDUX3", "EDUQA", "EDUGD",
    "EDU3Z", "EDUSA", "EDUN8", "EDUMN", "EDUP4", "EDUFA", "EDUQU", "EDUXU", "EDURK", "EDU9W",
    "EDUNE", "EDUW5", "EDU74", "EDU5F", "EDU9F", "EDUHP", "EDUUG", "EDU5V", "EDUBA", "EDUMP",
    "EDUTD", "EDU4F", "EDUWP", "EDU2D", "EDUQX", "EDUCC", "EDUSB", "EDUMW", "EDUAZ", "EDUYH",
    "EDUR5", "EDU2M", "EDUNS", "EDU7Y", "EDUKT", "EDUGG", "EDUA6", "EDUEH", "EDUGV", "EDU4M",
    "EDUTN", "EDUEK", "EDUC5", "EDUW2", "EDUPX", "EDUMR", "EDUZD", "EDUFJ", "EDUUZ", "EDU3U",
    "EDU6D", "EDU7M", "EDU7C", "EDUPA", "EDUM5", "EDUCB", "EDUW7", "EDU86", "EDU5P", "EDU4P",
    "EDUP2", "EDUG2", "EDU6Y", "EDU83", "EDUVX", "EDUHU", "EDU94", "EDURF", "EDUQ6", "EDUDX",
    "EDUDK", "EDUBT", "EDUMU", "EDURW", "EDU9N", "EDUE8", "EDUZZ", "EDUUF", "EDUR9", "EDUPD",
    "EDUPV", "EDUDY", "EDU73", "EDUVY", "EDUVV", "EDU36", "EDUYW", "EDU6W", "EDUGC", "EDU3K",
    "EDUCF", "EDUD8", "EDUAA", "EDUET", "EDUW8", "EDUYC", "EDUBB", "EDU7G", "EDU8Y", "EDU9S",
    "EDUME", "EDUEG", "EDUF3", "EDUSK", "EDUQR", "EDUKD", "EDU2C", "EDUH2", "EDUF2", "EDUCZ",
    "EDUB3", "EDU8H", "EDUZP", "EDU4D", "EDUVW", "EDUHN", "EDUDP", "EDUV6", "EDUTZ", "EDUXG",
    "EDUSF", "EDUN5", "EDU5C", "EDUWJ", "EDUY9", "EDUUY", "EDUTJ", "EDUSW", "EDUR8", "EDUFG",
    "EDUHR", "EDUNU", "EDURN", "EDU7A", "EDUUJ", "EDU2Z", "EDUSP", "EDU2G", "EDUSQ", "EDUNX",
    "EDUGR", "EDUXM", "EDUG9", "EDUH5", "EDU3G", "EDUHG", "EDU38", "EDUQT", "EDU7U", "EDUTU",
    "EDU4V", "EDUGJ", "EDUNK", "EDUZB", "EDUTQ", "EDUE2", "EDUUM", "EDUK3", "EDU28", "EDUM3",
    "EDU9V", "EDUEY", "EDUXP", "EDU2Y", "EDUS8", "EDU9B", "EDUY5", "EDU3D", "EDUVN", "EDUQV",
]);
// Per-student annual pricing (already at launch 40 % off — the public
// site shows ₹2500 / ₹2000 / ₹1500 as struck-through regular prices).
function perStudentPrice(students) {
    if (students <= 500)
        return 1500;
    if (students <= 1500)
        return 1200;
    return 900;
}
exports.perStudentPrice = perStudentPrice;
function calculatePrice(students, coupon) {
    const perStudent = perStudentPrice(students);
    const subtotal = students * perStudent;
    let discountAmount = 0;
    let discountLabel = "";
    let appliedCoupon = null;
    if (coupon && coupon.trim()) {
        const code = coupon.trim().toUpperCase();
        if (exports.FREE_ACCESS_CODES.has(code)) {
            // Early-access codes — reduce the BASE to ₹1, then GST stacks on ₹1.
            discountAmount = subtotal - 1;
            discountLabel = `Coupon ${code} applied — early-access pricing`;
            appliedCoupon = code;
        }
        else if (code === "LAUNCH50") {
            discountAmount = Math.round(subtotal * 0.5);
            discountLabel = "Coupon LAUNCH50 — extra 50 % off";
            appliedCoupon = code;
        }
        else if (code === "TEST1") {
            discountAmount = subtotal - 1;
            discountLabel = "Coupon TEST1 — test-mode price";
            appliedCoupon = code;
        }
        else {
            const err = new Error(`Invalid coupon code: ${code}`);
            err.code = "invalid-coupon";
            throw err;
        }
    }
    const afterDiscount = Math.max(1, subtotal - discountAmount);
    const gstAmount = Math.round(afterDiscount * 0.18);
    const totalAmount = afterDiscount + gstAmount;
    return {
        students,
        perStudent,
        subtotal,
        discountAmount,
        discountLabel,
        afterDiscount,
        gstAmount,
        totalAmount,
        appliedCoupon,
    };
}
exports.calculatePrice = calculatePrice;
//# sourceMappingURL=razorpayCoupons.js.map