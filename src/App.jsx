import React, { useEffect, useMemo, useState } from "react";
import {
  Zap, MapPin, ShoppingCart, User, LogOut, ClipboardList,
  Plus, Minus, CheckCircle2, Clock3, Wrench, CreditCard,
  ShieldCheck, ChevronRight, ChevronLeft, X, RefreshCw
} from "lucide-react";
import {
  supabase, supabaseConfigured, currentUser, signIn, signUp, signOut,
  getProfile, getServices, getLocations, addLocation, getCustomerOrders,
  getOrderItems, getOrderHistory, getOrderPins,
  confirmFinalBill, getPendingOrders, getElectricianProfile,
  getAssignedOrders, acceptOrder, startOrderWork, addTechnicianService,
  removeTechnicianService, generateFinalBill, verifyCompletedPin, startCashfreeBookingCheckout,
  startCashfreeFinalCheckout, createFinalPaymentQr
} from "./supabase";

const INSPECTION_FEE = 121;
const ADVANCE = 21;

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

function money(v) { return `₹${Number(v || 0).toFixed(2)}`; }
function prettyStatus(s) {
  return String(s || "").replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase());
}
function errorText(e) { return e?.message || String(e); }

function Header({ user, profile, role, onLogout, onLogin, onSignup }) {
  return <header className="topbar">
    <div className="brand"><span className="brandIcon"><Zap size={21}/></span><span>BijliMitra</span></div>
    <div className="topActions">
      {user && <span className="userBadge"><User size={15}/> <span className="userName">{profile?.full_name || user.email}</span>{role==="electrician" && <span className="roleBadge">Electrician</span>}</span>}
      {user && <button className="iconBtn" onClick={onLogout} title="Logout"><LogOut size={17}/></button>}
      {!user && (
  <>
    <button
      className="ghostBtn"
      onClick={onLogin}
    >
      Login
    </button>

    <button
      className="primary"
      onClick={onSignup}
    >
      Sign Up
    </button>
  </>
)}
       </div>
  </header>;
}

function Auth({ onDone,onBackHome ,initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  useEffect(() => {
  setMode(initialMode);
  }, [initialMode]);
  const [form, setForm] = useState({email:"",password:"",fullName:"",phone:"",role:"customer"});
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = mode === "login"
        ? await signIn(form.email, form.password)
        : await signUp(form.email, form.password, form.fullName, form.phone, form.role);
      if (r.error) throw r.error;
      if (mode === "signup" && !r.data?.session) {
        setErr("Account created. If email confirmation is enabled, confirm your email and then sign in.");
      } else onDone();
    } catch(e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  return <div className="authPage">
    <div className="authCard">
      <div className="authLogo"><Zap size={25}/></div>
      <h1>{mode==="login" ? "Welcome back" : "Create your BijliMitra account"}</h1>
      <p className="muted">{mode==="login" ? "Sign in to book an electrician." : "An account is required before placing an order."}</p>
      <form onSubmit={submit}>
        {mode==="signup" && <>
          <label>I am signing up as
            <div className="roleToggle">
              <button type="button" className={form.role==="customer"?"active":""} onClick={()=>setForm({...form,role:"customer"})}>Customer</button>
              <button type="button" className={form.role==="electrician"?"active":""} onClick={()=>setForm({...form,role:"electrician"})}>Electrician</button>
            </div>
          </label>
          <label>Full name<input required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
          <label>Phone<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        </>}
        <label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Password<input type="password" minLength="6" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
        {err && <div className="errorBox">{err}</div>}
        <button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode==="login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="linkBtn" onClick={()=>{setMode(mode==="login"?"signup":"login");setErr("")}}>
        {mode==="login" ? "New customer? Create account" : "Already have an account? Sign in"}
      </button>

      <button
       type="button"
       className="linkBtn"
       onClick={onBackHome}
>
       ← Back to Home
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

function BillBox({items, technicianItems=[], inspection=INSPECTION_FEE, advance=ADVANCE, final=false}) {
  const customerTotal = items.reduce((a,x)=>a + Number(x.price||x.unit_price||0)*Number(x.quantity||1),0);
  const techTotal = technicianItems.reduce((a,x)=>a + Number(x.price||x.unit_price||0)*Number(x.quantity||1),0);
  const total = customerTotal + techTotal + Number(inspection);
  return <div className="billBox">
    <div className="billRow"><span>Base Service Pack (incl. GST)</span><b>{money(customerTotal)}</b></div>
    <div className="billRow"><span>Visiting / Minimum Inspection Fee</span><b>{money(inspection)}</b></div>
    {technicianItems.length>0 && <div className="billRow"><span>Technician Added Services</span><b>{money(techTotal)}</b></div>}
    <div className="billRow strong"><span>{final ? "Final Total Work Amount" : "Estimated Total Work Amount"}</span><b>{money(total)}</b></div>
    <div className="billRow token"><span>Advance Booking Token</span><b>- {money(advance)}</b></div>
    <div className="billDue"><span>Due Amount After Token</span><strong>{money(Math.max(0,total-advance))}</strong></div>
    <div className="cancelNote">The ₹21.00 booking token is non-refundable once your slot is confirmed.</div>
  </div>;
}

function PinBox({pins}) {
  if (!pins) return null;
  return <div className="pinBox">
    <div className="pinBoxHead"><ShieldCheck size={16}/> Share these PINs only when asked</div>
    <div className="pinRow"><span>Work Start PIN</span><b>{pins.start_pin}</b></div>
    <div className="pinRow"><span>Work Completed PIN</span><b>{pins.completed_pin}</b></div>
    <p className="pinNote">Give the Start PIN to your electrician once they arrive. Give the Completed PIN only after the work is fully done.</p>
  </div>;
}

function LocationModal({userId,onClose,onSaved}) {
  const [f,setF]=useState({address_line:"",landmark:"",city:"",state:"",pincode:"",latitude:"",longitude:"",location_url:""});
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  async function save(e){e.preventDefault();setBusy(true);try{const x={...f,latitude:f.latitude?Number(f.latitude):null,longitude:f.longitude?Number(f.longitude):null,location_url:f.location_url?.trim()||null};const r=await addLocation(userId,x);onSaved(r);onClose();}catch(e){setErr(errorText(e))}finally{setBusy(false)}}
  return <div className="modalBackdrop"><div className="modal">
    <div className="modalHead"><h2>Service location</h2><button className="iconBtn" onClick={onClose}><X/></button></div>
    <form onSubmit={save}>
      <label>Address<input required value={f.address_line} onChange={e=>setF({...f,address_line:e.target.value})}/></label>
      <label>Landmark<input value={f.landmark} onChange={e=>setF({...f,landmark:e.target.value})}/></label>
      <div className="grid2"><label>City<input required value={f.city} onChange={e=>setF({...f,city:e.target.value})}/></label><label>State<input required value={f.state} onChange={e=>setF({...f,state:e.target.value})}/></label></div>
      <label>Pincode<input required pattern="[0-9]{6}" value={f.pincode} onChange={e=>setF({...f,pincode:e.target.value})}/></label>
      <label>Current location link <span className="muted">(optional)</span><input type="url" placeholder="Paste your Google Maps link" value={f.location_url} onChange={e=>setF({...f,location_url:e.target.value})}/></label>
      {err&&<div className="errorBox">{err}</div>}
      <button className="primary full" disabled={busy}>{busy?"Saving…":"Save location"}</button>
    </form>
  </div></div>
}

function Customer({user, profile, onRequireAuth}) {
  const [services,setServices]=useState(fallbackServices), [locations,setLocations]=useState([]), [orders,setOrders]=useState([]);
  const [cart,setCart]=useState({}), [locationId,setLocationId]=useState(""), [tab,setTab]=useState("book");
  const [step,setStep]=useState(1), [agreed,setAgreed]=useState(false);
  const [selectedOrder,setSelectedOrder]=useState(null), [items,setItems]=useState([]), [history,setHistory]=useState([]);
  const [pins,setPins]=useState(null);
 const [locModal,setLocModal]=useState(false);
const [busy,setBusy]=useState(false);
const [msg,setMsg]=useState("");
const [bookingError,setBookingError]=useState("");

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
      // webhook) once the ₹21 booking payment actually succeeds.
      setMsg("Opening ₹21 booking payment…");
      await startCashfreeBookingCheckout(locationId, selectedItems.map(x=>({service_id:x.id,quantity:x.quantity})));

      setMsg("Payment received. Confirming your booking…");
      setCart({});
      setStep(1); setAgreed(false);
      // The webhook may take a moment longer than the checkout modal to
      // finish creating the order, so poll briefly for it to show up.
      setTab("orders");
      for (let attempt=0; attempt<5; attempt++){
        await load();
        if ((await getCustomerOrders(user.id)).length > orders.length) break;
        await new Promise(r=>setTimeout(r,1500));
      }
      await load();
    }catch(e){
      setMsg(`Booking payment was not completed: ${errorText(e)}`);
    }finally{setBusy(false)}
  }
  async function openOrder(o){
    setSelectedOrder(o); setItems(await getOrderItems(o.id)); setHistory(await getOrderHistory(o.id));
    try{ setPins(await getOrderPins(o.id)); }catch(e){ setPins(null); }
  }
  async function refreshOrder(){if(selectedOrder){const fresh=(await getCustomerOrders(user.id)).find(x=>x.id===selectedOrder.id);if(fresh){setSelectedOrder(fresh);setItems(await getOrderItems(fresh.id));setHistory(await getOrderHistory(fresh.id));try{setPins(await getOrderPins(fresh.id));}catch(e){}}else await load();}}
  async function confirmBill(){
    setBusy(true);try{await confirmFinalBill(selectedOrder.id,user.id);await refreshOrder();setMsg("Final bill confirmed.");}catch(e){setMsg(errorText(e))}finally{setBusy(false)}
  }
  return <div className="page">
    <section className="hero">
      <div className="heroCopy">
        <h1>Book a certified electrician for today.</h1>
        <p>Flat ₹121 visit fee, priced services, and a ₹21 token that locks your slot — fully adjusted into the final bill.</p>
      </div>
      <div className="ticketStub">
        <div className="ticketStubTop">
          <span>Booking token</span>
          <ShieldCheck size={18}/>
        </div>
        <div className="ticketStubAmount">{money(ADVANCE)}</div>
        <div className="ticketStubFoot">Verified by Cashfree · adjusted into your bill</div>
      </div>
    </section>
    <nav className="tabs">
      <button className={tab==="book"?"active":""} onClick={()=>setTab("book")}><ShoppingCart/>Book service</button>
      {user && (
  <button onClick={() => setTab("orders")}>
    My orders
  </button>
)}
     {user && (
  <button onClick={() => setTab("account")}>
    Account
  </button>
)}
    </nav>
    {msg&&<div className="notice">{msg}</div>}

    {tab==="book" && <div className="wizard">
      {step===1 && <div className="wizardIntro">
        <Zap size={34}/>
        <h2>Ready to book an electrician?</h2>
        <p>You'll pick your services, choose a saved location, and lock your slot with a small ₹21 token — fully adjusted into your final bill.</p>
        <button className="primary" onClick={()=>setStep(2)}>Book Electrician</button>
      </div>}

      {step===2 && <div className="contentGrid">
        <main>
          <div className="sectionHead"><div><h2>Select services</h2><p>Choose multiple services and quantities.</p></div></div>
          <div className="serviceGrid">{services.map(s=><ServiceCard key={s.id} s={s} qty={cart[s.id]||0} onChange={q=>setCart({...cart,[s.id]:q})}/>)}</div>
        </main>
        <aside className="sticky">
          <BillBox items={selectedItems}/>
          <div className="wizardNav">
            <button className="secondary" onClick={()=>setStep(1)}><ChevronLeft size={16}/> Back</button>
            <button className="primary" disabled={!selectedItems.length} onClick={()=>setStep(3)}>Confirm items</button>
          </div>
        </aside>
      </div>}

      {step===3 && <div className="panel">
        <div className="sectionHead"><div><h2>Choose service location</h2><p>Pick where the electrician should visit.</p></div></div>
        {!user && <p className="muted">Login or Sign up to add and select a service location.</p>}
        {user && <>
          {locations.length ? <div className="locationPickList">
            {locations.map(l=><button key={l.id} className={`locationPick ${locationId===l.id?"selected":""}`} onClick={()=>setLocationId(l.id)}>
              <MapPin size={17}/>
              <div><b>{l.address_line}</b><span>{l.landmark} {l.city}, {l.state} — {l.pincode}</span></div>
              {locationId===l.id && <ShieldCheck size={17}/>}
            </button>)}
          </div> : <p className="muted">No saved locations yet — add one below.</p>}
          <button className="secondary full" onClick={()=>setLocModal(true)}><MapPin size={16}/> Add location</button>
        </>}
        <div className="wizardNav">
          <button className="secondary" onClick={()=>setStep(2)}><ChevronLeft size={16}/> Back</button>
          <button className="primary" disabled={!user||!locationId} onClick={()=>setStep(4)}>Confirm location</button>
        </div>
      </div>}

      {step===4 && <div className="panel">
        <div className="sectionHead"><div><h2>Review &amp; confirm</h2><p>Check everything before paying your booking token.</p></div></div>
        <BillBox items={selectedItems}/>
        <div className="termsBox">
          <h3>Terms &amp; conditions</h3>
          <ul>
            <li>The ₹21 booking token confirms your slot and is fully adjusted into your final bill — it is non-refundable once paid.</li>
            <li>The ₹121 visiting/inspection fee is included in every booking, regardless of the work done.</li>
            <li>Any additional services the electrician adds on-site will be reflected in the final bill, which you'll be asked to confirm before final payment.</li>
            <li>A Work Start PIN and Work Completed PIN are issued to you after booking — share these with your electrician only in person, at the relevant stage of the visit.</li>
          </ul>
        </div>
        <label className="agreeRow"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/> I agree to the terms &amp; conditions above.</label>
        <div className="wizardNav">
          <button className="secondary" onClick={()=>setStep(3)}><ChevronLeft size={16}/> Back</button>
          <button className="primary" disabled={busy||!agreed} onClick={placeOrder}>{busy?"Processing…":`Continue to ${money(ADVANCE)} booking payment`}</button>
        </div>
      </div>}
    </div>}

    {tab==="orders" && <div className="ordersLayout">
      <div className="orderList">
        <div className="sectionHead"><div><h2>My orders</h2><p>Your booking and work status.</p></div><button className="iconBtn" onClick={load}><RefreshCw size={17}/></button></div>
        {!orders.length?<div className="empty">No orders yet.</div>:orders.map(o=><button className="orderCard" key={o.id} onClick={()=>openOrder(o)}>
          <div><span className="orderId">#{o.id.slice(0,8).toUpperCase()}</span><h3>{prettyStatus(o.status)}</h3><span className="muted">{new Date(o.created_at).toLocaleString()}</span></div>
          <div className="orderRight"><b>{money(o.final_total || o.estimated_total)}</b><ChevronRight/></div>
        </button>)}
      </div>
      {selectedOrder && <div className="panel orderDetail">
        <div className="sectionHead"><div><span className="orderTag">#{selectedOrder.id.slice(0,8).toUpperCase()}</span><h2>{prettyStatus(selectedOrder.status)}</h2></div><button className="iconBtn" onClick={()=>setSelectedOrder(null)}><X/></button></div>
        <div className="timeline">{history.map((h,i)=><div className="timelineRow" key={h.id||i}><span className="dot"></span><div><b>{prettyStatus(h.status)}</b><p>{h.note}</p><small>{new Date(h.created_at).toLocaleString()}</small></div></div>)}</div>
        <PinBox pins={pins}/>
        <h3>Services</h3>{items.map(i=><div className="miniRow" key={i.id}><span>{i.service_name} × {i.quantity}</span><b>{money(i.total_price ?? i.unit_price*i.quantity)}</b></div>)}
        <BillBox items={items.filter(i=>i.source==="customer").map(i=>({price:i.unit_price,quantity:i.quantity}))} technicianItems={items.filter(i=>i.source==="technician").map(i=>({price:i.unit_price,quantity:i.quantity}))} inspection={selectedOrder.inspection_fee} advance={selectedOrder.advance_amount} final={Boolean(selectedOrder.final_total)}/>
        {selectedOrder.status==="final_bill_pending" && <button className="primary full" disabled={busy} onClick={confirmBill}>{busy?"Confirming…":"Confirm final bill"}</button>}
        {selectedOrder.status==="final_payment_pending" && <button className="primary full" disabled={busy} onClick={async()=>{
          setBusy(true); setMsg("");
          try{ await startCashfreeFinalCheckout(selectedOrder.id); setMsg("Cashfree checkout opened for the final bill."); }
          catch(e){ setMsg(errorText(e)); }
          finally{ setBusy(false); }
        }}><CreditCard size={17}/> {busy?"Opening checkout…":"Pay final bill"}</button>}
      </div>}
    </div>}

    {tab==="account" && <div className="accountGrid">
      <div className="panel"><h2>My account</h2><div className="profileRows"><div><span>Name</span><b>{profile?.full_name||"—"}</b></div><div><span>Email</span><b>{user.email}</b></div><div><span>Phone</span><b>{profile?.phone||"—"}</b></div><div><span>Role</span><b>Customer</b></div></div></div>
      <div className="panel"><div className="sectionHead"><h2>Saved locations</h2><button className="secondary" onClick={()=>setLocModal(true)}><Plus size={16}/> Add</button></div>{locations.map(l=><div className="locationRow" key={l.id}><MapPin size={17}/><div><b>{l.address_line}</b><span>{l.landmark} {l.city}, {l.state} — {l.pincode}{l.location_url && <> · <a href={l.location_url} target="_blank" rel="noreferrer">View shared location</a></>}</span></div></div>)}{!locations.length&&<p className="muted">No saved locations.</p>}</div>
    </div>}
    {locModal&&<LocationModal userId={user.id} onClose={()=>setLocModal(false)} onSaved={x=>{setLocations([x,...locations]);setLocationId(x.id)}}/>}
  </div>;
}

function Electrician({user}) {
  const [profile,setProfile]=useState(null),[pending,setPending]=useState([]),[assigned,setAssigned]=useState([]);
  const [services,setServices]=useState(fallbackServices),[selected,setSelected]=useState(null),[items,setItems]=useState([]);
  const [pin,setPin]=useState(""),[serviceId,setServiceId]=useState(""),[qty,setQty]=useState(1),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  const [qr,setQr]=useState(null);

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
  return <div className="page">
    <section className="dashHeader"><div><h1>Orders &amp; work</h1><p>Accept one job at a time. You become available again only after final payment.</p></div><div className={`availability ${profile?.availability||"unknown"}`}><span></span>{prettyStatus(profile?.availability||"Unknown")}</div></section>
    {msg&&<div className="notice">{msg}</div>}
    <div className="electricianGrid">
      <main>
        <div className="sectionHead"><div><h2>Pending orders</h2><p>Only confirmed ₹21 bookings are shown.</p></div><button className="iconBtn" onClick={load}><RefreshCw size={17}/></button></div>
        {pending.filter(o=>!active || o.id===active.id).map(o=><div className="pendingCard" key={o.id}><div><span className="orderId">#{o.id.slice(0,8).toUpperCase()}</span><h3>Service booking</h3>{o.customer_name && <p><b>{o.customer_name}</b>{o.customer_phone && <> · {o.customer_phone}</>}</p>}<p>{o.address_line}, {o.city} — {o.pincode}</p><b>{money(o.estimated_total)} estimated</b></div><button className="primary" disabled={busy||Boolean(active)} onClick={()=>doAction(()=>acceptOrder(o.id,user.id))}>{active?"Busy":"Accept order"}</button></div>)}
        {!pending.length&&<div className="empty">No confirmed pending orders.</div>}
        <h2 className="subHeading">My assigned orders</h2>
        {assigned.map(o=><button className={`assignedCard ${selected?.id===o.id?"selected":""}`} key={o.id} onClick={()=>selectOrder(o)}><span>#{o.id.slice(0,8).toUpperCase()}</span><b>{prettyStatus(o.status)}</b><span>{money(o.final_total||o.estimated_total)}</span></button>)}
      </main>
      <aside className="panel technicianPanel">
        {!selected?<div className="empty"><Wrench size={30}/><p>Select an assigned order.</p></div>:<>
          <div className="sectionHead"><div><span className="orderTag">#{selected.id.slice(0,8).toUpperCase()}</span><h2>{prettyStatus(selected.status)}</h2></div></div>
          {selected.customer_name && <div className="addressBox"><User size={18}/><span><b>{selected.customer_name}</b>{selected.customer_phone && <> · {selected.customer_phone}</>}</span></div>}
          <div className="addressBox"><MapPin size={18}/><span>{selected.address_line}, {selected.landmark}, {selected.city}, {selected.state} — {selected.pincode}{selected.location_url && <> · <a href={selected.location_url} target="_blank" rel="noreferrer">Open shared location</a></>}</span></div>
          <h3>Order services</h3>{items.map(i=><div className="miniRow" key={i.id}>
            <span>{i.service_name} × {i.quantity} <small>{i.source}</small></span>
            <span className="miniRowRight">
              <b>{money(i.total_price ?? i.unit_price*i.quantity)}</b>
              {i.source==="technician" && selected.status==="work_in_progress" && (
                <button className="iconBtn danger" title="Remove this service" disabled={busy} onClick={()=>doAction(()=>removeTechnicianService(selected.id,user.id,i.id))}><X size={14}/></button>
              )}
            </span>
          </div>)}

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
          </div>}
        </>}
      </aside>
    </div>
  </div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
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

  // Role is fixed at signup (see handle_new_user / the signup form's role
  // picker) and comes straight from the profile -- there is no in-app
  // toggle. An electrician account only ever sees the electrician console;
  // a customer account only ever sees the booking storefront.
  const effectiveRole = profile?.role === "electrician" ? "electrician" : "customer";

return (
 <>
    <Header
      user={user}
      profile={profile}
      role={effectiveRole}

      onLogout={async () => {
        await signOut();
        await loadUser();
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

  </>
);
}

export default App;