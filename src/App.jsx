import React, { useEffect, useMemo, useState, useContext, createContext } from "react";
import {
  Zap, MapPin, ShoppingCart, User, LogOut, ClipboardList,
  Plus, Minus, CheckCircle2, Clock3, Wrench, CreditCard,
  ShieldCheck, ChevronRight, ChevronLeft, ChevronDown, X, RefreshCw, Wallet, Eye, EyeOff, Lock, Pencil, Check
} from "lucide-react";
import {
  supabase, supabaseConfigured, currentUser, signIn, signUp, signOut, signInWithGoogle,
  getProfile, getServices, getLocations, addLocation, getCustomerOrders,
  getOrderItems, getOrderHistory, getOrderPins,
  confirmFinalBill, getPendingOrders, getElectricianProfile,
  getAssignedOrders, acceptOrder, startOrderWork, addTechnicianService,
  removeTechnicianService, generateFinalBill, verifyCompletedPin, startCashfreeBookingCheckout,
  startCashfreeFinalCheckout, createFinalPaymentQr, recordCashPayment,
  getDailyPayments, getAdminElectricians, getAdminOrders, getAdminOrdersByDate,
  getAdminPendingOrders, routeOrderToElectrician, unrouteOrder,
  requestPasswordReset, updatePassword, getOrderById, createElectrician,
  updateOwnPhone, adminUpdateElectricianPhone
} from "./supabase";

const ADVANCE = 51;

// ---- Hindi / English toggle ------------------------------------------
// Lightweight i18n: HI maps every translated English string to its Hindi
// version. t(text) looks up the current string; if it's missing from the
// dictionary it falls back to the original English text unchanged, so a
// forgotten string never breaks the page -- it just stays in English.
const HI = {
  "Serving the Rural India": "ग्रामीण भारत की सेवा में",
  "Login": "लॉगिन",
  "Sign Up": "साइन अप",
  "Logout": "लॉग आउट",
  "Book a certified electrician for today.": "आज ही एक प्रमाणित इलेक्ट्रीशियन बुक करें।",
  "Priced services, and a ₹51 visiting charge (inclusive of GST) that locks your slot — non-refundable and charged separately from your final bill.": "निर्धारित मूल्य वाली सेवाएँ, और ₹51 का विज़िटिंग चार्ज (जीएसटी सहित) जो आपकी बुकिंग को पक्का करता है — यह गैर-वापसी योग्य है और आपके अंतिम बिल से अलग लिया जाता है।",
  "Visiting Charge": "विज़िटिंग चार्ज",
  "Verified by Cashfree · non-refundable": "Cashfree द्वारा सत्यापित · गैर-वापसी योग्य",
  "Book service": "सेवा बुक करें",
  "Schedule a certified electrician": "एक प्रमाणित इलेक्ट्रीशियन शेड्यूल करें",
  "My orders": "मेरे ऑर्डर",
  "Track bookings and work status": "बुकिंग और कार्य की स्थिति देखें",
  "Account": "खाता",
  "Profile and saved locations": "प्रोफ़ाइल और सहेजे गए पते",
  "Select services": "सेवाएँ चुनें",
  "Choose multiple services and quantities.": "कई सेवाएँ और मात्राएँ चुनें।",
  "Back": "वापस",
  "Confirm items": "आइटम की पुष्टि करें",
  "Choose service location": "सेवा स्थान चुनें",
  "Pick where the electrician should visit.": "चुनें कि इलेक्ट्रीशियन कहाँ जाएगा।",
  "Login or Sign up to add and select a service location.": "सेवा स्थान जोड़ने और चुनने के लिए लॉगिन या साइन अप करें।",
  "No saved locations yet — add one below.": "अभी तक कोई सहेजा गया पता नहीं — नीचे एक जोड़ें।",
  "Add location": "पता जोड़ें",
  "Confirm location": "स्थान की पुष्टि करें",
  "Review & confirm": "समीक्षा करें और पुष्टि करें",
  "Check everything before paying your visiting charge.": "अपना विज़िटिंग चार्ज भरने से पहले सब कुछ जांच लें।",
  "Terms & conditions": "नियम और शर्तें",
  "I agree to the terms & conditions above.": "मैं ऊपर दिए गए नियमों और शर्तों से सहमत हूँ।",
  "Processing…": "प्रोसेस हो रहा है…",
  "My account": "मेरा खाता",
  "Name": "नाम",
  "Email": "ईमेल",
  "Phone": "फ़ोन",
  "Role": "भूमिका",
  "Customer": "ग्राहक",
  "Saved locations": "सहेजे गए पते",
  "Add": "जोड़ें",
  "No saved locations.": "कोई सहेजा गया पता नहीं।",
  "No orders yet.": "अभी तक कोई ऑर्डर नहीं।",
  "Your booking and work status.": "आपकी बुकिंग और कार्य की स्थिति।",
  "Ready to book an electrician?": "इलेक्ट्रीशियन बुक करने के लिए तैयार हैं?",
  "You'll pick your services, choose a saved location, and lock your slot with a ₹51 visiting charge (inclusive of GST) — non-refundable and charged separately from your final bill.": "आप अपनी सेवाएँ चुनेंगे, एक सहेजा गया पता चुनेंगे, और ₹51 के विज़िटिंग चार्ज (जीएसटी सहित) से अपनी बुकिंग पक्की करेंगे — यह गैर-वापसी योग्य है और आपके अंतिम बिल से अलग लिया जाता है।",
  "Book Electrician": "इलेक्ट्रीशियन बुक करें",
  "Welcome back": "वापसी पर स्वागत है",
  "Sign in to book an electrician.": "इलेक्ट्रीशियन बुक करने के लिए साइन इन करें।",
  "Create your BijliMitra account": "अपना BijliMitra खाता बनाएँ",
  "An account is required before placing an order.": "ऑर्डर देने से पहले एक खाता आवश्यक है।",
  "Reset your password": "अपना पासवर्ड रीसेट करें",
  "Enter your email and we'll send you a reset link.": "अपना ईमेल दर्ज करें और हम आपको एक रीसेट लिंक भेजेंगे।",
  "Full name": "पूरा नाम",
  "Password": "पासवर्ड",
  "Confirm password": "पासवर्ड की पुष्टि करें",
  "Forgot password?": "पासवर्ड भूल गए?",
  "← Back to sign in": "← साइन इन पर वापस जाएँ",
  "New customer? Create account": "नए ग्राहक हैं? खाता बनाएँ",
  "Already have an account? Sign in": "पहले से खाता है? साइन इन करें",
  "Please wait…": "कृपया प्रतीक्षा करें…",
  "Sign in": "साइन इन करें",
  "Send reset link": "रीसेट लिंक भेजें",
  "Create account": "खाता बनाएँ",
  "← Back to Home": "← होम पर वापस जाएँ",
  "Address": "पता",
  "Landmark": "लैंडमार्क",
  "Pincode": "पिनकोड",
  "State": "राज्य",
  "District": "ज़िला",
  "City / Village": "शहर / गाँव",
  "Select City / Village": "शहर / गाँव चुनें",
  "Service Address": "सेवा का पता",
  "Use This Address": "यह पता उपयोग करें",
  "Saving…": "सहेजा जा रहा है…",
  "Base Service Pack": "बेस सर्विस पैक",
  "GST (5%)": "जीएसटी (5%)",
  "Estimated Total Work Amount": "अनुमानित कुल कार्य राशि",
  "Final Total Work Amount": "अंतिम कुल कार्य राशि",
  "Amount Due": "देय राशि",
  "Technician Added Services": "तकनीशियन द्वारा जोड़ी गई सेवाएँ",
  "Visiting Charge Paid (incl. GST)": "विज़िटिंग चार्ज भुगतान किया गया (जीएसटी सहित)",
  "Visiting Charge (to be paid next, incl. GST)": "विज़िटिंग चार्ज (अगले चरण में भुगतान होगा, जीएसटी सहित)",
  "The {amount} visiting charge is non-refundable and is a separate charge — it is NOT adjusted against the amount due above.": "{amount} का विज़िटिंग चार्ज गैर-वापसी योग्य है और एक अलग शुल्क है — यह ऊपर दी गई देय राशि में समायोजित नहीं किया जाता है।",
  "You'll pay a {amount} visiting charge separately on the next step to confirm your slot. It's non-refundable and will NOT be adjusted against the amount due above.": "आप अपनी बुकिंग पक्की करने के लिए अगले चरण में अलग से {amount} का विज़िटिंग चार्ज भरेंगे। यह गैर-वापसी योग्य है और ऊपर दी गई देय राशि में समायोजित नहीं किया जाएगा।",
  "Share these PINs only when asked": "इन पिन को केवल पूछे जाने पर ही साझा करें",
  "Work Start PIN": "कार्य शुरू पिन",
  "Work Completed PIN": "कार्य पूर्ण पिन",
  "Give the Start PIN to your electrician once they arrive. Give the Completed PIN only after the work is fully done.": "इलेक्ट्रीशियन के पहुँचने पर उन्हें स्टार्ट पिन दें। पूर्ण पिन केवल तभी दें जब कार्य पूरी तरह से हो जाए।",
  "An undertaking of Kashvi Enterprises": "काश्वी एंटरप्राइजेज़ का एक उपक्रम",
  "Privacy Policy": "गोपनीयता नीति",
  "Phone number can't be empty.": "फ़ोन नंबर खाली नहीं हो सकता।",
  "Enter phone number": "फ़ोन नंबर दर्ज करें",
  "Save": "सहेजें",
  "Cancel": "रद्द करें",
  "Edit": "संपादित करें",
  "Not added": "जोड़ा नहीं गया",
  "Login or Sign up to continue": "जारी रखने के लिए लॉगिन या साइन अप करें",
  "or": "या",
  "Continue with Google": "Google से जारी रखें",
  "Please log in or create an account to book a service.": "सेवा बुक करने के लिए कृपया लॉगिन करें या एक खाता बनाएँ।",
  "Terms & conditions": "नियम और शर्तें",
  "The ₹51 visiting charge (inclusive of GST) confirms your slot. It is non-refundable once paid and is a separate charge — it is NOT adjusted into your final bill.": "₹51 का विज़िटिंग चार्ज (जीएसटी सहित) आपकी बुकिंग की पुष्टि करता है। यह भुगतान के बाद गैर-वापसी योग्य है और एक अलग शुल्क है — यह आपके अंतिम बिल में समायोजित नहीं किया जाता है।",
  "A 5% GST is added on top of the service amount (base pack plus any technician-added services) in your final bill.": "आपके अंतिम बिल में सेवा राशि (बेस पैक और तकनीशियन द्वारा जोड़ी गई किसी भी सेवा) पर 5% जीएसटी जोड़ा जाता है।",
  "Any additional services the electrician adds on-site will be reflected in the final bill, which you'll be asked to confirm before final payment.": "इलेक्ट्रीशियन द्वारा मौके पर जोड़ी गई कोई भी अतिरिक्त सेवा अंतिम बिल में दिखाई देगी, जिसे अंतिम भुगतान से पहले आपसे पुष्टि करने के लिए कहा जाएगा।",
  "A Work Start PIN and Work Completed PIN are issued to you after booking — share these with your electrician only in person, at the relevant stage of the visit.": "बुकिंग के बाद आपको एक वर्क स्टार्ट पिन और वर्क कम्प्लीटेड पिन दिया जाता है — इन्हें केवल संबंधित चरण में, व्यक्तिगत रूप से अपने इलेक्ट्रीशियन के साथ साझा करें।",
  "I agree to the terms & conditions above.": "मैं ऊपर दिए गए नियमों और शर्तों से सहमत हूँ।",
  "Continue to": "आगे बढ़ें",
  "visiting charge payment": "विज़िटिंग चार्ज भुगतान की ओर",
  "Pending": "लंबित",
  "Assigned": "सौंपा गया",
  "Work In Progress": "कार्य जारी है",
  "Final Bill Pending": "अंतिम बिल लंबित",
  "Customer Confirmed": "ग्राहक द्वारा पुष्टि की गई",
  "Final Payment Pending": "अंतिम भुगतान लंबित",
  "Completed": "पूर्ण",
  "Cancelled": "रद्द",
  "Your electrician:": "आपका इलेक्ट्रीशियन:",
  "Assigned": "सौंपा गया",
  "Open shared location": "साझा स्थान खोलें",
  "Services": "सेवाएँ",
  "Confirming…": "पुष्टि हो रही है…",
  "Confirm final bill": "अंतिम बिल की पुष्टि करें",
  "Opening checkout…": "चेकआउट खुल रहा है…",
  "Pay final bill": "अंतिम बिल का भुगतान करें",
  "View shared location": "साझा स्थान देखें",
};

const LanguageContext = createContext({ lang: "en", toggleLang: () => {}, t: (s) => s });
function useLanguage(){ return useContext(LanguageContext); }

function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("bijlimitra_lang") || "en"; } catch(e) { return "en"; }
  });
  function toggleLang(){
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    try { localStorage.setItem("bijlimitra_lang", next); } catch(e) {}
  }
  function t(text){
    return lang === "hi" ? (HI[text] || text) : text;
  }
  return <LanguageContext.Provider value={{ lang, toggleLang, t }}>{children}</LanguageContext.Provider>;
}

const fallbackServices = [
  ["Switch / Socket Replacement", 49, "piece"],
  ["Ceiling / Wall / Exhaust Fan Installation", 199, "fan"],
  ["Light Fitting (LED / Tube light / Holder)", 99, "light"],
  ["Chandelier (Jhoomar) Installation", 499, "job"],
  ["MCB Replacement", 75, "unit"],
  ["Inverter & Battery Complete Setup", 449, "job"],
  ["Geyser Electrical Fitting", 299, "job"],
  ["Water Motor / Starter Wiring", 349, "job"],
  ["New Point Wiring (Light / Fan)", 199, "point"],
  ["Power Point Wiring (16A / AC / Geyser)", 299, "point"],
  ["Fault Finding / Short Circuit Checking", 299, "job"]
].map(([name, price, unit], i) => ({ id: `demo-${i}`, name, price, unit, is_active: true }));

const ORDER_STATUSES = ["pending","assigned","work_in_progress","final_bill_pending","customer_confirmed","final_payment_pending","completed","cancelled"];

function money(v) { return `₹${Number(v || 0).toFixed(2)}`; }
// Electrician earnings formula (electrician + admin visibility only, never
// shown to the customer): the current service subtotal (customer +
// technician items, always excl. GST -- this already updates live as the
// electrician adds their own services), plus the visiting charge with its
// own 18% tax component stripped out, minus a 10% platform fee on that
// combined GST-excluded figure. Uses the order's own advance_amount rather
// than a hardcoded 51, so it stays correct if that amount ever changes.
function computeElectricianShare(order) {
  const subtotal = Number(order.customer_services_total || 0) + Number(order.technician_services_total || 0);
  const detaxedVisitingCharge = Number(order.advance_amount || 0) / 1.18;
  const totalEarningExclGst = subtotal + detaxedVisitingCharge;
  const platformFee = totalEarningExclGst * 0.10;
  return Math.round((totalEarningExclGst - platformFee) * 100) / 100;
}
function prettyStatus(s) {
  return String(s || "").replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase());
}
function errorText(e) { return e?.message || String(e); }

function Header({ user, profile, role, onLogout, onLogin, onSignup }) {
  const { lang, toggleLang, t } = useLanguage();
  return <header className="topbar">
    <div className="brand"><span className="brandIcon"><Zap size={21}/></span><span className="brandText"><span className="brandName">BijliMitra</span><span className="brandTagline">{t("Serving the Rural India")}</span></span></div>
    <div className="topActions">
      <button className="langToggle" onClick={toggleLang} title="Switch language">
        <span className={lang==="en"?"active":""}>EN</span>
        <span className={lang==="hi"?"active":""}>हिं</span>
      </button>
      {user && <span className="userBadge"><User size={15}/> <span className="userName">{profile?.full_name || user.email}</span>{role==="electrician" && <span className="roleBadge">Electrician</span>}{role==="admin" && <span className="roleBadge admin">Admin</span>}</span>}
      {user && <button className="iconBtn" onClick={onLogout} title={t("Logout")}><LogOut size={17}/></button>}
      {!user && (
  <>
    <button
      className="ghostBtn"
      onClick={onLogin}
    >
      {t("Login")}
    </button>

    <button
      className="primary"
      onClick={onSignup}
    >
      {t("Sign Up")}
    </button>
  </>
)}
       </div>
  </header>;
}

function Auth({ onDone,onBackHome ,initialMode = "login" }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(initialMode);
  useEffect(() => {
  setMode(initialMode);
  }, [initialMode]);
  const [form, setForm] = useState({email:"",password:"",confirmPassword:"",fullName:"",phone:""});
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [showConfirmPassword,setShowConfirmPassword]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr("");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) {
      setErr("Please enter a valid email address (e.g. name@example.com).");
      setBusy(false);
      return;
    }
    if (mode === "forgot") {
      try {
        const r = await requestPasswordReset(form.email.trim());
        if (r.error) throw r.error;
        setResetSent(true);
      } catch(e) { setErr(errorText(e)); } finally { setBusy(false); }
      return;
    }
    if (mode === "signup" && form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const r = mode === "login"
        ? await signIn(form.email, form.password)
        : await signUp(form.email, form.password, form.fullName, form.phone);
      if (r.error) throw r.error;
      if (mode === "signup" && !r.data?.session) {
        setErr("Account created. If email confirmation is enabled, confirm your email and then sign in.");
      } else onDone();
    } catch(e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  return <div className="authPage">
    <div className="authCard">
      <div className="authLogo"><Zap size={25}/></div>
      <h1>{mode==="login" ? t("Welcome back") : mode==="forgot" ? t("Reset your password") : t("Create your BijliMitra account")}</h1>
      <p className="muted">{mode==="login" ? t("Sign in to book an electrician.") : mode==="forgot" ? t("Enter your email and we'll send you a reset link.") : t("An account is required before placing an order.")}</p>

      {mode==="forgot" && resetSent ? (
        <div className="noticeBox">
          Check your inbox at <b>{form.email}</b> for a password reset link. It may take a minute to arrive.
        </div>
      ) : (
        <form onSubmit={submit}>
          {mode==="signup" && <>
            <label>{t("Full name")}<input required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
            <label>{t("Phone")}<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          </>}
          <label>{t("Email")}<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
          {mode!=="forgot" && <label>{t("Password")}
            <div className="passwordField">
              <input type={showPassword?"text":"password"} minLength="6" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
              <button type="button" className="passwordToggle" onClick={()=>setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword?"Hide password":"Show password"}>
                {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
              </button>
            </div>
          </label>}
          {mode==="login" && <button type="button" className="linkBtn forgotLink" onClick={()=>{setMode("forgot");setErr("");setResetSent(false)}}>{t("Forgot password?")}</button>}
          {mode==="signup" && <label>{t("Confirm password")}
            <div className="passwordField">
              <input type={showConfirmPassword?"text":"password"} minLength="6" required value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})}/>
              <button type="button" className="passwordToggle" onClick={()=>setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1} aria-label={showConfirmPassword?"Hide password":"Show password"}>
                {showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
              </button>
            </div>
          </label>}
          {err && <div className="errorBox">{err}</div>}
          <button className="primary full" disabled={busy}>{busy ? t("Please wait…") : mode==="login" ? t("Sign in") : mode==="forgot" ? t("Send reset link") : t("Create account")}</button>
        </form>
      )}

      {mode!=="forgot" && (
        <>
          <div className="authDivider"><span>{t("or")}</span></div>
          <button type="button" className="googleBtn" disabled={busy} onClick={async()=>{
            setBusy(true); setErr("");
            try{ const r = await signInWithGoogle(); if(r.error) throw r.error; }
            catch(e){ setErr(errorText(e)); setBusy(false); }
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
            {t("Continue with Google")}
          </button>
        </>
      )}

      {mode==="forgot" ? (
        <button className="linkBtn" onClick={()=>{setMode("login");setErr("");setResetSent(false)}}>{t("← Back to sign in")}</button>
      ) : (
        <button className="linkBtn" onClick={()=>{setMode(mode==="login"?"signup":"login");setErr("")}}>
          {mode==="login" ? t("New customer? Create account") : t("Already have an account? Sign in")}
        </button>
      )}

      <button
       type="button"
       className="linkBtn"
       onClick={onBackHome}
>
       {t("← Back to Home")}
      </button>
    </div>
  </div>;
}

function ServiceCard({s, qty, onChange}) {
  return <div className="serviceCard">
    <div>
      <h3>{s.name}</h3>
      <div className="price">{money(s.price)} <span>/ {s.unit || "item"}</span></div>
    </div>
    <div className="qty">
      <button onClick={()=>onChange(Math.max(0,qty-1))}><Minus size={15}/></button>
      <b>{qty}</b>
      <button onClick={()=>onChange(qty+1)}><Plus size={15}/></button>
    </div>
  </div>;
}

function BillBox({items, technicianItems=[], advance=ADVANCE, final=false, paid=true}) {
  const { t } = useLanguage();
  const GST_RATE = 0.05;
  const customerTotal = items.reduce((a,x)=>a + Number(x.price||x.unit_price||0)*Number(x.quantity||1),0);
  const techTotal = technicianItems.reduce((a,x)=>a + Number(x.price||x.unit_price||0)*Number(x.quantity||1),0);
  const subtotal = customerTotal + techTotal;
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = subtotal + gst;
  return <div className="billBox">
    <div className="billRow"><span>{t("Base Service Pack")}</span><b>{money(customerTotal)}</b></div>
    {technicianItems.length>0 && <div className="billRow"><span>{t("Technician Added Services")}</span><b>{money(techTotal)}</b></div>}
    <div className="billRow"><span>{t("GST (5%)")}</span><b>{money(gst)}</b></div>
    <div className="billRow strong"><span>{final ? t("Final Total Work Amount") : t("Estimated Total Work Amount")}</span><b>{money(total)}</b></div>
    <div className="billRow token"><span>{paid ? t("Visiting Charge Paid (incl. GST)") : t("Visiting Charge (to be paid next, incl. GST)")}</span><b>{money(advance)}</b></div>
    <div className="billDue"><span>{t("Amount Due")}</span><strong>{money(total)}</strong></div>
    <div className="cancelNote">{paid
      ? t("The {amount} visiting charge is non-refundable and is a separate charge — it is NOT adjusted against the amount due above.").replace("{amount}", money(advance))
      : t("You'll pay a {amount} visiting charge separately on the next step to confirm your slot. It's non-refundable and will NOT be adjusted against the amount due above.").replace("{amount}", money(advance))}</div>
  </div>;
}

function PinBox({pins}) {
  const { t } = useLanguage();
  if (!pins) return null;
  return <div className="pinBox">
    <div className="pinBoxHead"><ShieldCheck size={16}/> {t("Share these PINs only when asked")}</div>
    <div className="pinRow"><span>{t("Work Start PIN")}</span><b>{pins.start_pin}</b></div>
    <div className="pinRow"><span>{t("Work Completed PIN")}</span><b>{pins.completed_pin}</b></div>
    <p className="pinNote">{t("Give the Start PIN to your electrician once they arrive. Give the Completed PIN only after the work is fully done.")}</p>
  </div>;
}

const VILLAGE_OPTIONS = [
  "Bihat", "Urvarak Nagar Township", "Zeromile", "Pipra Dih", "Garhara",
  "Nipania", "Teghra Bajaar", "Hazipur", "Pipra Devas", "Barauni Block"
];

function LocationModal({userId,onClose,onSaved}) {
  const { t } = useLanguage();
  const [f,setF]=useState({landmark:"",city:"",pincode:"",latitude:"",longitude:""});
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  async function save(e){
    e.preventDefault();
    if(!f.city){ setErr("Please select a City / Village."); return; }
    setBusy(true);
    try{
      const x={
        // No separate free-text "address" field in this design -- the
        // landmark is the only manually-entered identifying detail, so it
        // doubles as address_line too (that column is still NOT NULL in
        // the database). Display templates elsewhere show landmark once,
        // not both.
        address_line: f.landmark.trim(),
        landmark: f.landmark.trim(),
        city: f.city,
        district: "Begusarai",
        state: "Bihar",
        pincode: f.pincode,
        latitude: f.latitude?Number(f.latitude):null,
        longitude: f.longitude?Number(f.longitude):null
      };
      const r=await addLocation(userId,x);
      onSaved(r);
      onClose();
    }catch(e){setErr(errorText(e))}finally{setBusy(false)}
  }
  return <div className="modalBackdrop"><div className="modal">
    <div className="modalHead"><h2>{t("Service Address")}</h2><button className="iconBtn" onClick={onClose}><X/></button></div>
    <form onSubmit={save}>
      <label>{t("State")}<div className="lockedField"><span>Bihar</span><Lock size={14}/></div></label>
      <label>{t("District")}<div className="lockedField"><span>Begusarai</span><Lock size={14}/></div></label>
      <label>{t("City / Village")}<select required value={f.city} onChange={e=>setF({...f,city:e.target.value})}>
        <option value="">{t("Select City / Village")}</option>
        {VILLAGE_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
      </select></label>
      <label>{t("Landmark")}<input required placeholder="Enter Landmark (e.g. Near Temple, Bus Stand)" value={f.landmark} onChange={e=>setF({...f,landmark:e.target.value})}/></label>
      <label>{t("Pincode")}<input required pattern="[0-9]{6}" value={f.pincode} onChange={e=>setF({...f,pincode:e.target.value})}/></label>
      {err&&<div className="errorBox">{err}</div>}
      <button className="primary full" disabled={busy}>{busy?t("Saving…"):t("Use This Address")}</button>
    </form>
  </div></div>
}

function Customer({user, profile, onRequireAuth}) {
  const { t } = useLanguage();
  const [services,setServices]=useState(fallbackServices), [locations,setLocations]=useState([]), [orders,setOrders]=useState([]);
  const [cart,setCart]=useState({}), [locationId,setLocationId]=useState(""), [tab,setTab]=useState("home");
  const [step,setStep]=useState(1), [agreed,setAgreed]=useState(false);
  const [selectedOrder,setSelectedOrder]=useState(null), [items,setItems]=useState([]), [history,setHistory]=useState([]);
  const [pins,setPins]=useState(null);
 const [locModal,setLocModal]=useState(false);
const [busy,setBusy]=useState(false);
const [msg,setMsg]=useState("");
const [bookingError,setBookingError]=useState("");
const [showLoginPrompt,setShowLoginPrompt]=useState(false);
const [openCategories,setOpenCategories]=useState({});
const [editingPhone,setEditingPhone]=useState(false);
const [phoneDraft,setPhoneDraft]=useState(profile?.phone||"");
const [phoneValue,setPhoneValue]=useState(profile?.phone||"");
const [phoneBusy,setPhoneBusy]=useState(false);
const [phoneErr,setPhoneErr]=useState("");

useEffect(()=>{ setPhoneValue(profile?.phone||""); setPhoneDraft(profile?.phone||""); }, [profile?.phone]);

async function savePhone() {
  const trimmed = phoneDraft.trim();
  if (!trimmed) { setPhoneErr(t("Phone number can't be empty.")); return; }
  setPhoneBusy(true); setPhoneErr("");
  try {
    await updateOwnPhone(user.id, trimmed);
    setPhoneValue(trimmed);
    setEditingPhone(false);
  } catch(e) {
    setPhoneErr(errorText(e));
  } finally {
    setPhoneBusy(false);
  }
}

const servicesByCategory = useMemo(()=>{
  const groups = {};
  services.forEach(s=>{
    const cat = s.category || "Other Services";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  });
  return groups;
}, [services]);

 async function load() {
  try {

    // Services can be viewed without login
    if (supabaseConfigured) {
      setServices(await getServices());
    }

    // These require the customer to be logged in
    if (user && supabaseConfigured) {
      setLocations(await getLocations(user.id));
      setOrders(await getCustomerOrders(user.id));
    }

  } catch (e) {
    setMsg(errorText(e));
  }
}
  useEffect(() => {
  load();
}, [user]);

  // Live updates: whenever any of this customer's orders change status (or
  // their items/PINs/history change), refresh in place -- no manual
  // refresh button, no polling delay.
  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`customer-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` }, () => {
        load();
        if (selectedOrder) refreshOrder();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, () => {
        if (selectedOrder) refreshOrder();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        if (selectedOrder) refreshOrder();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_pins" }, () => {
        if (selectedOrder) refreshOrder();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedOrder?.id]);
  const selectedItems=useMemo(()=>services.filter(s=>cart[s.id]>0).map(s=>({...s,quantity:cart[s.id]})),[services,cart]);
  const customerTotal=selectedItems.reduce((a,x)=>a+x.price*x.quantity,0);

  async function placeOrder(){
    console.log("PLACE ORDER FUNCTION CLICKED");
    if (!user) {
  setMsg("Please Login or Sign Up to continue with your booking and payment.");
  onRequireAuth("login");
  return;
}
    if (!locationId && !selectedItems.length) {
  alert("Please select a location and at least 1 service.");
  return;
}

if (!locationId) {
  alert("Please select a location.");
  return;
}

if (!selectedItems.length) {
  alert("Please select at least 1 service.");
  return;
}
    setBusy(true);setMsg("");
    try{
      // No order is created here. Cashfree checkout opens directly against
      // the cart; the real order only gets created (server-side, in the
      // webhook) once the ₹51 visiting charge actually succeeds.
      setMsg("Opening ₹51 visiting charge payment…");
      const priorOrderCount = orders.length;
      await startCashfreeBookingCheckout(locationId, selectedItems.map(x=>({service_id:x.id,quantity:x.quantity})));

      // The Cashfree checkout call resolving successfully means the modal
      // closed WITHOUT a payment error -- it does not yet mean the order
      // has been created (that only happens once our webhook has heard
      // back from Cashfree and run). So we don't claim success yet; we
      // wait to actually see the new order appear before saying so.
      setMsg("Payment submitted. Confirming your booking…");
      setCart({});
      setStep(1); setAgreed(false);
      setTab("orders");
      let confirmed = false;
      for (let attempt=0; attempt<6; attempt++){
        await load();
        if ((await getCustomerOrders(user.id)).length > priorOrderCount) { confirmed = true; break; }
        await new Promise(r=>setTimeout(r,1500));
      }
      await load();
      setMsg(confirmed
        ? "Booking confirmed!"
        : "Payment was submitted, but we couldn't confirm your booking yet. If the payment succeeded this can take a little longer to appear -- pull to refresh My Orders in a moment. If it doesn't show up, the payment likely wasn't completed and you can try again.");
    }catch(e){
      setMsg(`Booking payment was not completed: ${errorText(e)}`);
    }finally{setBusy(false)}
  }
  async function openOrder(o){
    setSelectedOrder(o); setItems(await getOrderItems(o.id)); setHistory(await getOrderHistory(o.id));
    try{ setPins(await getOrderPins(o.id)); }catch(e){ setPins(null); }
  }
  async function refreshOrder(){
    if(!selectedOrder) return;
    const fresh=(await getCustomerOrders(user.id)).find(x=>x.id===selectedOrder.id);
    if(!fresh){ await load(); return; }
    const justCompleted = fresh.status==="completed" && selectedOrder.status!=="completed";
    if(justCompleted){
      // Order just finished (final payment succeeded) -- close the detail
      // popup automatically instead of leaving payment/PIN details open.
      // The customer can still reopen it any time from the order list.
      setSelectedOrder(null);
      await load();
      return;
    }
    setSelectedOrder(fresh);setItems(await getOrderItems(fresh.id));setHistory(await getOrderHistory(fresh.id));try{setPins(await getOrderPins(fresh.id));}catch(e){}
  }
  async function confirmBill(){
    setBusy(true);try{await confirmFinalBill(selectedOrder.id,user.id);await refreshOrder();setMsg("Final bill confirmed.");}catch(e){setMsg(errorText(e))}finally{setBusy(false)}
  }
  return <div className="page">
    {tab==="home" ? <>
      <section className="hero">
        <div className="heroCopy">
          <h1>{t("Book a certified electrician for today.")}</h1>
          <p>{t("Priced services, and a ₹51 visiting charge (inclusive of GST) that locks your slot — non-refundable and charged separately from your final bill.")}</p>
        </div>
        <div className="ticketStub">
          <div className="ticketStubTop">
            <span>{t("Visiting Charge")}</span>
            <ShieldCheck size={18}/>
          </div>
          <div className="ticketStubAmount">{money(ADVANCE)}</div>
          <div className="ticketStubFoot">{t("Verified by Cashfree · non-refundable")}</div>
        </div>
      </section>
      <nav className="menuGrid">
        <button className="menuCard" onClick={()=>{ if(!user){ setShowLoginPrompt(true); } else { setTab("book"); } }}>
          <ShoppingCart size={20}/>
          <div><b>{t("Book service")}</b><span>{t("Schedule a certified electrician")}</span></div>
          <ChevronRight size={18}/>
        </button>
        {user && <button className="menuCard" onClick={()=>setTab("orders")}>
          <ClipboardList size={20}/>
          <div><b>{t("My orders")}</b><span>{t("Track bookings and work status")}</span></div>
          <ChevronRight size={18}/>
        </button>}
        {user && <button className="menuCard" onClick={()=>setTab("account")}>
          <User size={20}/>
          <div><b>{t("Account")}</b><span>{t("Profile and saved locations")}</span></div>
          <ChevronRight size={18}/>
        </button>}
      </nav>
    </> : <div className="pageHeader">
      <button className="iconBtn" onClick={()=>setTab("home")}><ChevronLeft size={18}/></button>
      <h2>{tab==="book"?t("Book service"):tab==="orders"?t("My orders"):t("Account")}</h2>
    </div>}
    {msg&&<div className="notice">{msg}</div>}

    {tab==="book" && <div className="wizard">
      {step===1 && <div className="wizardIntro">
        <Zap size={34}/>
        <h2>{t("Ready to book an electrician?")}</h2>
        <p>{t("You'll pick your services, choose a saved location, and lock your slot with a ₹51 visiting charge (inclusive of GST) — non-refundable and charged separately from your final bill.")}</p>
        <button className="primary" onClick={()=>setStep(2)}>{t("Book Electrician")}</button>
      </div>}

      {step===2 && <div className="contentGrid">
        <main>
          <div className="sectionHead"><div><h2>{t("Select services")}</h2><p>{t("Choose multiple services and quantities.")}</p></div></div>
          <div className="serviceCategories">
            {Object.entries(servicesByCategory).map(([category, catServices])=>{
              const isOpen = openCategories[category] === true;
              const selectedCount = catServices.filter(s=>cart[s.id]>0).length;
              return <div className="serviceCategoryGroup" key={category}>
                <button type="button" className="serviceCategoryHeader" onClick={()=>setOpenCategories({...openCategories,[category]:!isOpen})}>
                  <span>{category}</span>
                  <span className="serviceCategoryHeaderRight">
                    {selectedCount>0 && <span className="categoryBadge">{selectedCount} selected</span>}
                    <ChevronDown size={16} className={isOpen?"chevronOpen":""}/>
                  </span>
                </button>
                {isOpen && <div className="serviceGrid">{catServices.map(s=><ServiceCard key={s.id} s={s} qty={cart[s.id]||0} onChange={q=>setCart({...cart,[s.id]:q})}/>)}</div>}
              </div>;
            })}
          </div>
        </main>
        <aside className="sticky">
          <BillBox items={selectedItems} paid={false}/>
          <div className="wizardNav">
            <button className="secondary" onClick={()=>setStep(1)}><ChevronLeft size={16}/> {t("Back")}</button>
            <button className="primary" disabled={!selectedItems.length} onClick={()=>setStep(3)}>{t("Confirm items")}</button>
          </div>
        </aside>
      </div>}

      {step===3 && <div className="panel">
        <div className="sectionHead"><div><h2>{t("Choose service location")}</h2><p>{t("Pick where the electrician should visit.")}</p></div></div>
        {!user && <p className="muted">{t("Login or Sign up to add and select a service location.")}</p>}
        {user && <>
          {locations.length ? <div className="locationPickList">
            {locations.map(l=><button key={l.id} className={`locationPick ${locationId===l.id?"selected":""}`} onClick={()=>setLocationId(l.id)}>
              <MapPin size={17}/>
              <div><b>{l.landmark}</b><span>{l.city}, {l.district}, {l.state} — {l.pincode}</span></div>
              {locationId===l.id && <ShieldCheck size={17}/>}
            </button>)}
          </div> : <p className="muted">{t("No saved locations yet — add one below.")}</p>}
          <button className="secondary full" onClick={()=>setLocModal(true)}><MapPin size={16}/> {t("Add location")}</button>
        </>}
        <div className="wizardNav">
          <button className="secondary" onClick={()=>setStep(2)}><ChevronLeft size={16}/> {t("Back")}</button>
          <button className="primary" disabled={!user||!locationId} onClick={()=>setStep(4)}>{t("Confirm location")}</button>
        </div>
      </div>}

      {step===4 && <div className="panel">
        <div className="sectionHead"><div><h2>{t("Review & confirm")}</h2><p>{t("Check everything before paying your visiting charge.")}</p></div></div>
        <BillBox items={selectedItems} paid={false}/>
        <div className="termsBox">
          <h3>{t("Terms & conditions")}</h3>
          <ul>
            <li>{t("The ₹51 visiting charge (inclusive of GST) confirms your slot. It is non-refundable once paid and is a separate charge — it is NOT adjusted into your final bill.")}</li>
            <li>{t("A 5% GST is added on top of the service amount (base pack plus any technician-added services) in your final bill.")}</li>
            <li>{t("Any additional services the electrician adds on-site will be reflected in the final bill, which you'll be asked to confirm before final payment.")}</li>
            <li>{t("A Work Start PIN and Work Completed PIN are issued to you after booking — share these with your electrician only in person, at the relevant stage of the visit.")}</li>
          </ul>
        </div>
        <label className="agreeRow"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/> {t("I agree to the terms & conditions above.")}</label>
        <div className="wizardNav">
          <button className="secondary" onClick={()=>setStep(3)}><ChevronLeft size={16}/> {t("Back")}</button>
          <button className="primary" disabled={busy||!agreed} onClick={placeOrder}>{busy?t("Processing…"):`${t("Continue to")} ${money(ADVANCE)} ${t("visiting charge payment")}`}</button>
        </div>
      </div>}
    </div>}

    {tab==="orders" && <div className="ordersLayout">
      <div className="orderList">
        <div className="sectionHead"><div><h2>{t("My orders")}</h2><p>{t("Your booking and work status.")}</p></div><button className="iconBtn" onClick={load}><RefreshCw size={17}/></button></div>
        {!orders.length?<div className="empty">{t("No orders yet.")}</div>:orders.map(o=><button className="orderCard" key={o.id} onClick={()=>openOrder(o)}>
          <div><span className="orderId">#{o.id.slice(0,8).toUpperCase()}</span><h3>{t(prettyStatus(o.status))}</h3><span className="muted">{new Date(o.created_at).toLocaleString()}</span></div>
          <div className="orderRight"><b>{money(o.final_total || o.estimated_total)}</b><ChevronRight/></div>
        </button>)}
      </div>
    </div>}
    {tab==="orders" && selectedOrder && <div className="modalBackdrop" onClick={()=>setSelectedOrder(null)}>
      <div className="modal orderDetail" onClick={e=>e.stopPropagation()}>
        <div className="sectionHead"><div><span className="orderTag">#{selectedOrder.id.slice(0,8).toUpperCase()}</span><h2>{t(prettyStatus(selectedOrder.status))}</h2></div><button className="iconBtn" onClick={()=>setSelectedOrder(null)}><X/></button></div>
        <div className="timeline">{history.map((h,i)=><div className="timelineRow" key={h.id||i}><span className="dot"></span><div><b>{t(prettyStatus(h.status))}</b><p>{h.note}</p><small>{new Date(h.created_at).toLocaleString()}</small></div></div>)}</div>
        {selectedOrder.electrician && <div className="addressBox"><User size={18}/><span>{t("Your electrician:")} <b>{selectedOrder.electrician.full_name || t("Assigned")}</b></span></div>}
        <div className="addressBox"><MapPin size={18}/><span>{selectedOrder.landmark}, {selectedOrder.city}, {selectedOrder.district}, {selectedOrder.state} — {selectedOrder.pincode}{selectedOrder.location_url && <> · <a href={selectedOrder.location_url} target="_blank" rel="noreferrer">{t("Open shared location")}</a></>}</span></div>
        <PinBox pins={pins}/>
        <h3>{t("Services")}</h3>{items.map(i=><div className="miniRow" key={i.id}><span>{i.service_name} × {i.quantity}</span><b>{money(i.total_price ?? i.unit_price*i.quantity)}</b></div>)}
        <BillBox items={items.filter(i=>i.source==="customer").map(i=>({price:i.unit_price,quantity:i.quantity}))} technicianItems={items.filter(i=>i.source==="technician").map(i=>({price:i.unit_price,quantity:i.quantity}))} advance={selectedOrder.advance_amount} final={Boolean(selectedOrder.final_total)}/>
        {selectedOrder.status==="final_bill_pending" && <button className="primary full" disabled={busy} onClick={confirmBill}>{busy?t("Confirming…"):t("Confirm final bill")}</button>}
        {selectedOrder.status==="final_payment_pending" && <button className="primary full" disabled={busy} onClick={async()=>{
          setBusy(true); setMsg("");
          try{ await startCashfreeFinalCheckout(selectedOrder.id); setMsg("Cashfree checkout opened for the final bill."); }
          catch(e){ setMsg(errorText(e)); }
          finally{ setBusy(false); }
        }}><CreditCard size={17}/> {busy?t("Opening checkout…"):t("Pay final bill")}</button>}
      </div>
    </div>}


    {tab==="account" && <div className="accountGrid">
      <div className="panel"><h2>{t("My account")}</h2><div className="profileRows">
        <div><span>{t("Name")}</span><b>{profile?.full_name||"—"}</b></div>
        <div><span>{t("Email")}</span><b>{user.email}</b></div>
        <div>
          <span>{t("Phone")}</span>
          {editingPhone ? (
            <div className="inlineEditRow">
              <input
                className="inlineEditInput"
                value={phoneDraft}
                onChange={e=>setPhoneDraft(e.target.value)}
                placeholder={t("Enter phone number")}
                disabled={phoneBusy}
              />
              <button className="iconBtn" disabled={phoneBusy} onClick={savePhone} title={t("Save")}><Check size={16}/></button>
              <button className="iconBtn" disabled={phoneBusy} onClick={()=>{setEditingPhone(false);setPhoneDraft(phoneValue);setPhoneErr("")}} title={t("Cancel")}><X size={16}/></button>
            </div>
          ) : (
            <b className="inlineEditRow">
              {phoneValue || t("Not added")}
              <button className="iconBtn" onClick={()=>{setEditingPhone(true);setPhoneDraft(phoneValue)}} title={t("Edit")}><Pencil size={14}/></button>
            </b>
          )}
          {phoneErr && <div className="fieldError">{phoneErr}</div>}
        </div>
        <div><span>{t("Role")}</span><b>{t("Customer")}</b></div>
      </div></div>
      <div className="panel"><div className="sectionHead"><h2>{t("Saved locations")}</h2><button className="secondary" onClick={()=>setLocModal(true)}><Plus size={16}/> {t("Add")}</button></div>{locations.map(l=><div className="locationRow" key={l.id}><MapPin size={17}/><div><b>{l.landmark}</b><span>{l.city}, {l.district}, {l.state} — {l.pincode}{l.location_url && <> · <a href={l.location_url} target="_blank" rel="noreferrer">{t("View shared location")}</a></>}</span></div></div>)}{!locations.length&&<p className="muted">{t("No saved locations.")}</p>}</div>
    </div>}
    {locModal&&<LocationModal userId={user.id} onClose={()=>setLocModal(false)} onSaved={x=>{setLocations([x,...locations]);setLocationId(x.id)}}/>}
    {showLoginPrompt && <div className="modalBackdrop" onClick={()=>setShowLoginPrompt(false)}>
      <div className="modal loginPromptModal" onClick={e=>e.stopPropagation()}>
        <div className="modalHead"><h2>{t("Login or Sign up to continue")}</h2><button className="iconBtn" onClick={()=>setShowLoginPrompt(false)}><X/></button></div>
        <p className="muted">{t("Please log in or create an account to book a service.")}</p>
        <div className="loginPromptActions">
          <button className="secondary full" onClick={()=>{ setShowLoginPrompt(false); onRequireAuth("login"); }}>{t("Login")}</button>
          <button className="primary full" onClick={()=>{ setShowLoginPrompt(false); onRequireAuth("signup"); }}>{t("Sign Up")}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function Electrician({user}) {
  const [profile,setProfile]=useState(null),[pending,setPending]=useState([]),[assigned,setAssigned]=useState([]);
  const [services,setServices]=useState(fallbackServices),[selected,setSelected]=useState(null),[items,setItems]=useState([]);
  const [pin,setPin]=useState(""),[serviceId,setServiceId]=useState(""),[qty,setQty]=useState(1),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  const [qr,setQr]=useState(null);
  const [completedDateFilter,setCompletedDateFilter]=useState("");

  async function requestFinalQr(orderId){
    setBusy(true);setMsg("");
    try{ setQr(await createFinalPaymentQr(orderId)); }
    catch(e){ setMsg(errorText(e)); }
    finally{ setBusy(false); }
  }

  async function load(){
    if(!supabaseConfigured)return;
    try{setProfile(await getElectricianProfile(user.id));setPending(await getPendingOrders());setAssigned(await getAssignedOrders(user.id));setServices(await getServices())}catch(e){setMsg(errorText(e))}
  }
  useEffect(()=>{load()},[]);

  // Periodic safety-net refresh: realtime updates can miss the moment a
  // pending order becomes invisible to this electrician (e.g. right after
  // an admin unroutes it -- Postgres changes filtered by RLS don't always
  // notify the client that a row it could see has become invisible). This
  // catches that within a short window even if no realtime event arrives.
  useEffect(()=>{
    const interval = setInterval(()=>{ load(); }, 20000);
    return ()=>clearInterval(interval);
  },[]);

  // Live updates: the pending list, assigned orders, and the currently
  // selected order's items all refresh the instant anything changes in the
  // DB -- no manual refresh, no polling delay.
  async function refreshSelected(){
    if(!selected) return;
    const fresh=(await getAssignedOrders(user.id)).find(x=>x.id===selected.id);
    if(fresh){ setSelected(fresh); setItems(await getOrderItems(fresh.id)); }
  }
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`electrician-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        load();
        refreshSelected();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        refreshSelected();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id, selected?.id]);

  async function selectOrder(o){setSelected(o);setItems(await getOrderItems(o.id));setQr(null);}
  async function doAction(fn){setBusy(true);setMsg("");try{await fn();await load();if(selected){const fresh=(await getAssignedOrders(user.id)).find(x=>x.id===selected.id);if(fresh){setSelected(fresh);setItems(await getOrderItems(fresh.id));}}}catch(e){setMsg(errorText(e))}finally{setBusy(false)}}
  const active = assigned.find(o=>["assigned","work_in_progress","final_bill_pending","customer_confirmed","final_payment_pending"].includes(o.status));
  const inProgressOrders = assigned.filter(o=>o.status!=="completed");
  const completedOrders = assigned.filter(o=>o.status==="completed");
  const filteredCompleted = completedDateFilter
    ? completedOrders.filter(o=>o.created_at && o.created_at.slice(0,10)===completedDateFilter)
    : completedOrders;
  const displayedCompleted = completedDateFilter ? filteredCompleted : filteredCompleted.slice(0,5);
  return <div className="page">
    <section className="dashHeader"><div><h1>Orders &amp; work</h1><p>Accept one job at a time. You become available again only after final payment.</p></div><div className={`availability ${profile?.availability||"unknown"}`}><span></span>{prettyStatus(profile?.availability||"Unknown")}</div></section>
    {msg&&<div className="notice">{msg}</div>}
    <div className="electricianGrid">
      <main>
        <div className="sectionHead"><div><h2>Pending orders</h2><p>Only confirmed ₹51 visiting-charge bookings are shown.</p></div><button className="iconBtn" onClick={load}><RefreshCw size={17}/></button></div>
        {pending.filter(o=>!active || o.id===active.id).map(o=><div className="pendingCard" key={o.id}><div><span className="orderId">#{o.id.slice(0,8).toUpperCase()}</span><h3>Service booking</h3>{o.customer_name && <p><b>{o.customer_name}</b>{o.customer_phone && <> · {o.customer_phone}</>}</p>}<p>{o.landmark}, {o.city}, {o.district}, {o.state} — {o.pincode}{o.location_url && <> · <a href={o.location_url} target="_blank" rel="noreferrer">Open shared location</a></>}</p><b>{money(o.estimated_total)} estimated</b></div><button className="primary" disabled={busy||Boolean(active)} onClick={()=>doAction(()=>acceptOrder(o.id,user.id))}>{active?"Busy":"Accept order"}</button></div>)}
        {!pending.length&&<div className="empty">No confirmed pending orders.</div>}

        <h2 className="subHeading">Orders in progress</h2>
        {inProgressOrders.map(o=><button className={`assignedCard ${selected?.id===o.id?"selected":""}`} key={o.id} onClick={()=>selectOrder(o)}><span>#{o.id.slice(0,8).toUpperCase()}</span><b>{prettyStatus(o.status)}</b><span>{money(o.final_total||o.estimated_total)}</span></button>)}
        {!inProgressOrders.length && <div className="empty">No orders in progress.</div>}

        <div className="sectionHead"><h2 className="subHeading">Completed orders</h2>
          <div className="dateFilter">
            <input type="date" value={completedDateFilter} onChange={e=>setCompletedDateFilter(e.target.value)}/>
            {completedDateFilter && <button className="iconBtn" title="Clear date filter" onClick={()=>setCompletedDateFilter("")}><X size={16}/></button>}
          </div>
        </div>
        <div className="tableWrap">
          <table className="adminTable">
            <thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {displayedCompleted.map(o=><tr key={o.id} className="clickableRow" onClick={()=>selectOrder(o)}>
                <td>#{o.id.slice(0,8).toUpperCase()}</td>
                <td>{prettyStatus(o.status)}</td>
                <td>{money(o.final_total||o.estimated_total)}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>)}
              {!displayedCompleted.length && <tr><td colSpan="4" className="muted">{completedDateFilter ? "No completed orders on this date." : "No completed orders yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        {!completedDateFilter && completedOrders.length>5 && <p className="muted tableHint">Showing 5 most recent — use the date filter above to see more.</p>}
      </main>
      <aside className="panel technicianPanel">
        {!selected?<div className="empty"><Wrench size={30}/><p>Select an assigned order.</p></div>:<>
          <div className="sectionHead"><div><span className="orderTag">#{selected.id.slice(0,8).toUpperCase()}</span><h2>{prettyStatus(selected.status)}</h2></div></div>
          {selected.customer_name && <div className="addressBox"><User size={18}/><span><b>{selected.customer_name}</b>{selected.customer_phone && <> · {selected.customer_phone}</>}</span></div>}
          <div className="addressBox"><MapPin size={18}/><span>{selected.landmark}, {selected.city}, {selected.district}, {selected.state} — {selected.pincode}{selected.location_url && <> · <a href={selected.location_url} target="_blank" rel="noreferrer">Open shared location</a></>}</span></div>
          <h3>Order services</h3>{items.map(i=><div className="miniRow" key={i.id}>
            <span>{i.service_name} × {i.quantity} <small>{i.source}</small></span>
            <span className="miniRowRight">
              <b>{money(i.total_price ?? i.unit_price*i.quantity)}</b>
              {i.source==="technician" && selected.status==="work_in_progress" && (
                <button className="iconBtn danger" title="Remove this service" disabled={busy} onClick={()=>doAction(()=>removeTechnicianService(selected.id,user.id,i.id))}><X size={14}/></button>
              )}
            </span>
          </div>)}
          <div className="earningsBox"><span>Your Share</span><b>{money(computeElectricianShare(selected))}</b></div>

          {selected.status==="assigned" && <div className="actionBox"><h3>Start work</h3><p>Ask the customer for the Work Start PIN.</p><input inputMode="numeric" maxLength="6" placeholder="Enter start PIN" value={pin} onChange={e=>setPin(e.target.value)}/><button className="primary full" disabled={busy} onClick={()=>doAction(()=>startOrderWork(selected.id,pin))}>Verify & start work</button></div>}

          {selected.status==="work_in_progress" && <div className="actionBox"><h3>Add technician service</h3><select value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Select service</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} — {money(s.price)}</option>)}</select><div className="qtyLine"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus/></button><b>{qty}</b><button onClick={()=>setQty(qty+1)}><Plus/></button></div><button className="secondary full" disabled={busy||!serviceId} onClick={()=>doAction(()=>addTechnicianService(selected.id,user.id,serviceId,qty))}>Add service</button><button className="primary full" disabled={busy} onClick={()=>doAction(()=>generateFinalBill(selected.id,user.id))}>Generate final bill</button></div>}

          {selected.status==="final_bill_pending" && <div className="actionBox"><h3>Waiting for customer</h3><p>The customer must review and confirm the final bill before you can complete the work.</p></div>}

          {selected.status==="customer_confirmed" && <div className="actionBox"><h3>Work completed PIN</h3><p>Enter the PIN provided by the customer. This moves the order to final payment pending.</p><input inputMode="numeric" maxLength="6" placeholder="Enter completed PIN" value={pin} onChange={e=>setPin(e.target.value)}/><button className="primary full" disabled={busy} onClick={()=>doAction(()=>verifyCompletedPin(selected.id,user.id,pin))}>Verify completed PIN</button></div>}

          {selected.status==="final_payment_pending" && <div className="actionBox">
            <h3>Final payment pending</h3>
            {!qr ? <>
              <p>Generate a UPI QR code for the customer to scan and pay the remaining amount in person.</p>
              <button className="primary full" disabled={busy} onClick={()=>requestFinalQr(selected.id)}><CreditCard/> {busy?"Generating QR…":"Generate payment QR"}</button>
            </> : <div className="qrBox">
              <img src={qr.qrImageDataUrl} alt="Scan to pay" width="220" height="220"/>
              <div className="qrAmount">{money(qr.amount)}</div>
              <p className="muted">Ask the customer to scan this with any UPI app.</p>
              <button className="secondary full" disabled={busy} onClick={()=>doAction(async()=>{})}><RefreshCw size={15}/> Refresh status</button>
              {qr.isSandbox && qr.cfPaymentId && <div className="sandboxHelper">
                <p><b>Sandbox testing:</b> scanning this QR for real won't complete a payment (no real bank is behind a sandbox merchant). To simulate a successful payment and test the rest of the flow, run this from your machine (needs your Cashfree sandbox x-client-id / x-client-secret):</p>
                <pre>{`curl -X POST https://sandbox.cashfree.com/pg/simulate \\
  -H "Content-Type: application/json" \\
  -H "x-api-version: 2025-01-01" \\
  -H "x-client-id: YOUR_SANDBOX_CLIENT_ID" \\
  -H "x-client-secret: YOUR_SANDBOX_CLIENT_SECRET" \\
  -d '{"entity":"PAYMENTS","entity_id":"${qr.cfPaymentId}","entity_simulation":{"payment_status":"SUCCESS"}}'`}</pre>
                <p className="muted">This triggers Cashfree's real success webhook, which completes the order exactly like a genuine payment would.</p>
              </div>}
            </div>}
            <div className="cashDivider"><span>or</span></div>
            <button className="secondary full" disabled={busy} onClick={()=>doAction(()=>recordCashPayment(selected.id,user.id))}><Wallet size={16}/> {busy?"Marking as paid…":`Received ${money(selected.amount_due)} in cash`}</button>
          </div>}
        </>}
      </aside>
    </div>
  </div>;
}

function Admin({user}) {
  const [dailyPayments,setDailyPayments]=useState([]);
  const [electricians,setElectricians]=useState([]);
  const [orders,setOrders]=useState([]);
  const [pendingOrders,setPendingOrders]=useState([]);
  const [routing,setRouting]=useState({});
  const [routeBusy,setRouteBusy]=useState(null);
  const [msg,setMsg]=useState("");
  const [loading,setLoading]=useState(true);
  const [selectedDate,setSelectedDate]=useState("");
  const [dateOrders,setDateOrders]=useState(null);
  const [dateLoading,setDateLoading]=useState(false);
  const [statusFilter,setStatusFilter]=useState("");
  const [selectedAdminOrder,setSelectedAdminOrder]=useState(null);
  const [adminOrderItems,setAdminOrderItems]=useState([]);
  const [adminOrderHistory,setAdminOrderHistory]=useState([]);
  const [adminOrderPins,setAdminOrderPins]=useState(null);
  const [adminOrderLoading,setAdminOrderLoading]=useState(false);
  const [showAddElectrician,setShowAddElectrician]=useState(false);
  const [newElectrician,setNewElectrician]=useState({email:"",password:"",fullName:"",phone:""});
  const [addElectricianBusy,setAddElectricianBusy]=useState(false);
  const [addElectricianErr,setAddElectricianErr]=useState("");
  const [editingElectricianPhone,setEditingElectricianPhone]=useState(null);
  const [electricianPhoneDraft,setElectricianPhoneDraft]=useState("");
  const [electricianPhoneBusy,setElectricianPhoneBusy]=useState(false);
  const [electricianPhoneErr,setElectricianPhoneErr]=useState("");

  async function saveElectricianPhone(electricianId){
    const trimmed = electricianPhoneDraft.trim();
    if (!trimmed) { setElectricianPhoneErr("Phone number can't be empty."); return; }
    setElectricianPhoneBusy(true); setElectricianPhoneErr("");
    try {
      await adminUpdateElectricianPhone(electricianId, trimmed);
      setElectricians(electricians.map(e => e.id === electricianId ? { ...e, profiles: { ...e.profiles, phone: trimmed } } : e));
      setEditingElectricianPhone(null);
    } catch(e) {
      setElectricianPhoneErr(e?.message || String(e));
    } finally {
      setElectricianPhoneBusy(false);
    }
  }

  async function submitNewElectrician(e){
    e.preventDefault();
    setAddElectricianErr("");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(newElectrician.email.trim())) {
      setAddElectricianErr("Please enter a valid email address.");
      return;
    }
    if (newElectrician.password.length < 6) {
      setAddElectricianErr("Password must be at least 6 characters.");
      return;
    }
    setAddElectricianBusy(true);
    try{
      await createElectrician(newElectrician.email.trim(), newElectrician.password, newElectrician.fullName.trim(), newElectrician.phone.trim());
      setNewElectrician({email:"",password:"",fullName:"",phone:""});
      setShowAddElectrician(false);
      await load();
    }catch(e){ setAddElectricianErr(errorText(e)); }
    finally{ setAddElectricianBusy(false); }
  }

  async function openAdminOrder(o){
    setSelectedAdminOrder(o);
    setAdminOrderLoading(true);
    try{
      const [full, it, hist] = await Promise.all([getOrderById(o.id), getOrderItems(o.id), getOrderHistory(o.id)]);
      setSelectedAdminOrder(full);
      setAdminOrderItems(it); setAdminOrderHistory(hist);
      try{ setAdminOrderPins(await getOrderPins(o.id)); }catch(e){ setAdminOrderPins(null); }
    }catch(e){ setMsg(errorText(e)); }
    finally{ setAdminOrderLoading(false); }
  }

  async function load(){
    try{
      const [dp, el, or, po] = await Promise.all([getDailyPayments(30), getAdminElectricians(), getAdminOrders(100), getAdminPendingOrders()]);
      setDailyPayments(dp); setElectricians(el); setOrders(or); setPendingOrders(po);
    }catch(e){ setMsg(errorText(e)); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  async function doRoute(orderId){
    const electricianId = routing[orderId];
    if(!electricianId) return;
    setRouteBusy(orderId); setMsg("");
    try{ await routeOrderToElectrician(orderId, electricianId); await load(); }
    catch(e){ setMsg(errorText(e)); }
    finally{ setRouteBusy(null); }
  }
  async function doUnroute(orderId){
    setRouteBusy(orderId); setMsg("");
    try{ await unrouteOrder(orderId); await load(); }
    catch(e){ setMsg(errorText(e)); }
    finally{ setRouteBusy(null); }
  }

  // Fetching is triggered directly from the date input's onChange below --
  // deliberately not through a useEffect watching selectedDate. Tying it
  // straight to the one event that reliably fires (confirmed: the page
  // title above updates correctly every time) removes any dependency on
  // effect re-run timing.
  async function loadForDate(d){
    if(!d){ setDateOrders(null); return; }
    setDateLoading(true);
    try{ setDateOrders(await getAdminOrdersByDate(d)); }
    catch(e){ setMsg(errorText(e)); }
    finally{ setDateLoading(false); }
  }

  // Live updates -- the dashboard reflects new orders/payments/status
  // changes the instant they happen, same as the customer/electrician views.
  useEffect(()=>{
    if(!supabase) return;
    const channel = supabase.channel("admin-dashboard")
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>{ load(); if(selectedDate) loadForDate(selectedDate); })
      .on("postgres_changes",{event:"*",schema:"public",table:"payments"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"electrician_profiles"},load)
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[selectedDate]);

  if(loading) return <div className="page"><div className="loading"><Zap/> Loading dashboard…</div></div>;

  const displayOrders = (selectedDate ? (dateOrders||[]) : orders).filter(o => !statusFilter || o.status === statusFilter);

  return <div className="page">
    <section className="dashHeader"><div><h1>Admin dashboard</h1><p>Payments, electrician status, and recent orders across the platform.</p></div></section>
    {msg && <div className="notice">{msg}</div>}

    <div className="adminGrid">
      <div className="panel">
        <div className="sectionHead"><div><h2>Daily payments</h2><p>Last {dailyPayments.length} days with activity.</p></div></div>
        <div className="tableWrap">
          <table className="adminTable">
            <thead><tr><th>Date</th><th>Bookings</th><th>Final</th><th>Cash</th><th>Total</th></tr></thead>
            <tbody>
              {dailyPayments.map(d=><tr key={d.day}>
                <td>{new Date(d.day).toLocaleDateString()}</td>
                <td>{d.booking_count} · {money(d.booking_total)}</td>
                <td>{d.final_count} · {money(d.final_total)}</td>
                <td>{d.cash_count} · {money(d.cash_total)}</td>
                <td><b>{money(d.total_amount)}</b></td>
              </tr>)}
              {!dailyPayments.length && <tr><td colSpan="5" className="muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="sectionHead"><h2>Electricians</h2><button className="secondary" onClick={()=>setShowAddElectrician(!showAddElectrician)}><Plus size={16}/> Add Electrician</button></div>
        {showAddElectrician && <form className="addElectricianForm" onSubmit={submitNewElectrician}>
          <label>Full name<input required value={newElectrician.fullName} onChange={e=>setNewElectrician({...newElectrician,fullName:e.target.value})}/></label>
          <label>Phone<input required value={newElectrician.phone} onChange={e=>setNewElectrician({...newElectrician,phone:e.target.value})}/></label>
          <label>Email<input type="email" required value={newElectrician.email} onChange={e=>setNewElectrician({...newElectrician,email:e.target.value})}/></label>
          <label>Password<input type="password" minLength="6" required value={newElectrician.password} onChange={e=>setNewElectrician({...newElectrician,password:e.target.value})}/></label>
          {addElectricianErr && <div className="errorBox">{addElectricianErr}</div>}
          <button className="primary full" disabled={addElectricianBusy}>{addElectricianBusy?"Creating…":"Create electrician account"}</button>
        </form>}
        {electricians.map(e=><div className="miniRow electricianRow" key={e.id}>
          <span>
            {e.profiles?.full_name || "—"}{" "}
            {editingElectricianPhone===e.id ? (
              <span className="inlineEditRow">
                <input
                  className="inlineEditInput small"
                  value={electricianPhoneDraft}
                  onChange={ev=>setElectricianPhoneDraft(ev.target.value)}
                  placeholder="Phone number"
                  disabled={electricianPhoneBusy}
                />
                <button className="iconBtn" disabled={electricianPhoneBusy} onClick={()=>saveElectricianPhone(e.id)} title="Save"><Check size={14}/></button>
                <button className="iconBtn" disabled={electricianPhoneBusy} onClick={()=>{setEditingElectricianPhone(null);setElectricianPhoneErr("")}} title="Cancel"><X size={14}/></button>
              </span>
            ) : (
              <small className="inlineEditRow">
                {e.profiles?.phone || "No phone"}
                <button className="iconBtn" onClick={()=>{setEditingElectricianPhone(e.id);setElectricianPhoneDraft(e.profiles?.phone||"");setElectricianPhoneErr("")}} title="Edit phone"><Pencil size={12}/></button>
              </small>
            )}
            {editingElectricianPhone===e.id && electricianPhoneErr && <div className="fieldError">{electricianPhoneErr}</div>}
          </span>
          <span className={`availability ${e.availability}`}><span></span>{prettyStatus(e.availability)}</span>
        </div>)}
        {!electricians.length && <p className="muted">No electricians yet.</p>}
      </div>
    </div>

    <div className="panel adminSection">
      <div className="sectionHead"><div><h2>Pending orders</h2><p>Route each order to an electrician. They'll only see orders routed to them.</p></div></div>
      {!pendingOrders.length && <p className="muted">No pending orders right now.</p>}
      {pendingOrders.map(o=>{
        const routedTo = o.routed_electrician_id ? electricians.find(e=>e.id===o.routed_electrician_id) : null;
        return <div className="pendingCard clickableRow" key={o.id} onClick={()=>openAdminOrder(o)}>
          <div>
            <span className="orderId">#{o.id.slice(0,8).toUpperCase()}</span>
            <h3>{o.customer_name || "—"}{o.customer_phone && <> · {o.customer_phone}</>}</h3>
            <p>{o.landmark}, {o.city} — {o.pincode}</p>
            <b>{money(o.estimated_total)} estimated</b>
          </div>
          <div className="routeControls" onClick={e=>e.stopPropagation()}>
            {routedTo
              ? <>
                  <span className="routedBadge">Routed to {routedTo.profiles?.full_name || "electrician"}</span>
                  <button className="secondary" disabled={routeBusy===o.id} onClick={()=>doUnroute(o.id)}>{routeBusy===o.id?"…":"Unroute"}</button>
                </>
              : <>
                  <select value={routing[o.id]||""} onChange={e=>setRouting({...routing,[o.id]:e.target.value})}>
                    <option value="">Select electrician…</option>
                    {electricians.map(e=><option key={e.id} value={e.id}>{e.profiles?.full_name || "Unnamed"} — {prettyStatus(e.availability)}</option>)}
                  </select>
                  <button className="primary" disabled={routeBusy===o.id || !routing[o.id]} onClick={()=>doRoute(o.id)}>{routeBusy===o.id?"Routing…":"Route"}</button>
                </>
            }
          </div>
        </div>;
      })}
    </div>

    <div className="panel adminSection">
      <div className="sectionHead">
        <div><h2>{selectedDate ? `Orders on ${new Date(selectedDate).toLocaleDateString()}` : "Recent orders"}</h2><p>{displayOrders.length} order(s) shown{statusFilter?` · filtered to ${prettyStatus(statusFilter)}`:""}.</p></div>
        <div className="dateFilter">
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map(s=><option key={s} value={s}>{prettyStatus(s)}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={e=>{
            const d = e.target.value;
            setSelectedDate(d);
            loadForDate(d);
          }}/>
          {selectedDate && <button className="iconBtn" title="Clear date filter" onClick={()=>{ setSelectedDate(""); setDateOrders(null); }}><X size={16}/></button>}
        </div>
      </div>
      <div className="tableWrap">
        <table className="adminTable">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Paid</th><th>Due</th><th>Date</th></tr></thead>
          <tbody>
            {dateLoading && selectedDate && <tr><td colSpan="6" className="muted">Loading…</td></tr>}
            {!dateLoading && displayOrders.map(o=><tr key={o.id} className="clickableRow" onClick={()=>openAdminOrder(o)}>
              <td>#{o.id.slice(0,8).toUpperCase()}</td>
              <td>{o.customer_name||"—"}<br/><small className="muted">{o.customer_phone}</small></td>
              <td>{prettyStatus(o.status)}</td>
              <td>{money(o.amount_paid)}</td>
              <td>{money(o.amount_due)}</td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
            </tr>)}
            {!dateLoading && !displayOrders.length && <tr><td colSpan="6" className="muted">{statusFilter ? `No ${prettyStatus(statusFilter).toLowerCase()} orders${selectedDate?" on this date":""}.` : selectedDate ? "No orders on this date." : "No orders yet."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    {selectedAdminOrder && <div className="modalBackdrop" onClick={()=>setSelectedAdminOrder(null)}>
      <div className="modal orderDetail" onClick={e=>e.stopPropagation()}>
        <div className="sectionHead">
          <div><span className="orderTag">#{selectedAdminOrder.id.slice(0,8).toUpperCase()}</span><h2>{prettyStatus(selectedAdminOrder.status)}</h2></div>
          <button className="iconBtn" onClick={()=>setSelectedAdminOrder(null)}><X/></button>
        </div>
        {adminOrderLoading ? <div className="empty">Loading order details…</div> : <>
          {selectedAdminOrder.customer_name && <div className="addressBox"><User size={18}/><span><b>{selectedAdminOrder.customer_name}</b>{selectedAdminOrder.customer_phone && <> · {selectedAdminOrder.customer_phone}</>}</span></div>}
          <div className="addressBox"><MapPin size={18}/><span>{selectedAdminOrder.landmark}, {selectedAdminOrder.city}, {selectedAdminOrder.district}, {selectedAdminOrder.state} — {selectedAdminOrder.pincode}{selectedAdminOrder.location_url && <> · <a href={selectedAdminOrder.location_url} target="_blank" rel="noreferrer">Open shared location</a></>}</span></div>
          {selectedAdminOrder.routed_electrician_id && <div className="addressBox"><Wrench size={18}/><span>Routed to: <b>{electricians.find(e=>e.id===selectedAdminOrder.routed_electrician_id)?.profiles?.full_name || "electrician"}</b></span></div>}
          <PinBox pins={adminOrderPins}/>
          <h3>Services</h3>
          {adminOrderItems.map(i=><div className="miniRow" key={i.id}><span>{i.service_name} × {i.quantity} <small>{i.source}</small></span><b>{money(i.total_price ?? i.unit_price*i.quantity)}</b></div>)}
          <BillBox
            items={adminOrderItems.filter(i=>i.source==="customer").map(i=>({price:i.unit_price,quantity:i.quantity}))}
            technicianItems={adminOrderItems.filter(i=>i.source==="technician").map(i=>({price:i.unit_price,quantity:i.quantity}))}
            advance={selectedAdminOrder.advance_amount}
            final={Boolean(selectedAdminOrder.final_total)}
          />
          <h3>Status history</h3>
          <div className="timeline">{adminOrderHistory.map((h,i)=><div className="timelineRow" key={h.id||i}><span className="dot"></span><div><b>{prettyStatus(h.status)}</b><p>{h.note}</p><small>{new Date(h.created_at).toLocaleString()}</small></div></div>)}</div>
          <div className="earningsBox"><span>Electrician's Share</span><b>{money(computeElectricianShare(selectedAdminOrder))}</b></div>
        </>}
      </div>
    </div>}
  </div>;
}

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault(); setErr("");
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setErr("Passwords do not match."); return; }
    setBusy(true);
    try {
      const r = await updatePassword(password);
      if (r.error) throw r.error;
      onDone();
    } catch(e) { setErr(errorText(e)); } finally { setBusy(false); }
  }

  return <div className="authPage">
    <div className="authCard">
      <div className="authLogo"><Zap size={25}/></div>
      <h1>Set a new password</h1>
      <p className="muted">Choose a new password for your account.</p>
      <form onSubmit={submit}>
        <label>New password
          <div className="passwordField">
            <input type={showPassword?"text":"password"} minLength="6" required value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" className="passwordToggle" onClick={()=>setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword?"Hide password":"Show password"}>
              {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
            </button>
          </div>
        </label>
        <label>Confirm new password
          <input type={showPassword?"text":"password"} minLength="6" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
        </label>
        {err && <div className="errorBox">{err}</div>}
        <button className="primary full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </div>
  </div>;
}

function Footer() {
  const { t } = useLanguage();
  return <footer className="siteFooter">
    <div className="siteFooterInner">
      <div className="siteFooterBrand"><Zap size={16}/> BijliMitra</div>
      <div className="siteFooterInfo">
        <span><b>{t("An undertaking of Kashvi Enterprises")}</b></span>
        <span>·</span>
        <span>Bihat, Ward No. 11, Mandir Marg, Barauni, Begusarai, Bihar — 851115</span>
        <span>·</span>
        <a href="tel:+917338795810">+91 73387 95810</a>
        <span>·</span>
        <a href="/privacy.html">{t("Privacy Policy")}</a>
      </div>
    </div>
  </footer>;
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  async function loadUser(){
    setLoading(true);
    try {
      const u=await currentUser(); setUser(u);
      if(u && supabaseConfigured){const p=await getProfile(u.id);setProfile(p)}
    } catch(e){console.error(e)} finally{setLoading(false)}
  }
 useEffect(() => {
  loadUser();

  if (!supabase) return;

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (_event === "PASSWORD_RECOVERY") {
      // The user arrived here via the password-reset email link. Supabase
      // has already given them a temporary recovery session -- show the
      // "set new password" screen instead of the normal app.
      setPasswordRecovery(true);
    }
    setUser(session?.user ?? null);

    if (!session) {
      setProfile(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
  if(loading) return <div className="loading"><Zap/> Loading BijliMitra…</div>;

  if (passwordRecovery) {
    return <ResetPassword onDone={()=>{ setPasswordRecovery(false); loadUser(); }}/>;
  }

  // Role is fixed at signup (see handle_new_user / the signup form's role
  // picker) and comes straight from the profile -- there is no in-app
  // toggle. An electrician account only ever sees the electrician console;
  // a customer account only ever sees the booking storefront.
  const effectiveRole = profile?.role === "electrician" ? "electrician" : profile?.role === "admin" ? "admin" : "customer";

return (
 <>
    <Header
      user={user}
      profile={profile}
      role={effectiveRole}

      onLogout={async () => {
        await signOut();
        // Full reload rather than just re-fetching the user: this
        // guarantees a completely clean slate after logout -- no leftover
        // component state (cart, selected order, admin routing selections,
        // electrician's in-progress QR, etc.) and no lingering realtime
        // subscriptions from the previous session, regardless of whether
        // the person was a customer, electrician, or admin.
        window.location.reload();
      }}

      onLogin={() => {
        setAuthMode("login");
        setShowAuth(true);
      }}

      onSignup={() => {
        setAuthMode("signup");
        setShowAuth(true);
      }}
    />

    {!supabaseConfigured && (
      <div className="demoBanner">
        Demo UI mode: add VITE_SUPABASE_URL and
        VITE_SUPABASE_ANON_KEY to connect the real database.
      </div>
    )}

    {showAuth ? (

      <Auth
        initialMode={authMode}
        onDone={() => {
          setShowAuth(false);
          loadUser();
        }}

         onBackHome={() => {
         setShowAuth(false);
        }}
      />

    ) : effectiveRole === "electrician" && user ? (

      <Electrician user={user} />

    ) : effectiveRole === "admin" && user ? (

      <Admin user={user} />

    ) : (

      <Customer
        user={user}
        profile={profile}

        onRequireAuth={(mode = "login") => {
          setAuthMode(mode);
          setShowAuth(true);
        }}
      />

    )}

    <Footer/>
  </>
);
}

export default function Root(){
  return <LanguageProvider><App/></LanguageProvider>;
}