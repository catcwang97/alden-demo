import { useState, useEffect, useRef } from "react";

const C = {
  bg:"#f5f5f2",surface:"#fff",border:"#e8e8e3",
  text:"#1a1a1a",muted:"#9a9a8f",
  green:"#2d8a4e",greenBg:"#edf7f1",
  red:"#d94f3b",redBg:"#fdecea",
  amber:"#c97c1a",amberBg:"#fdf4e7",
  purple:"#5b4fcf",purpleLight:"#ede9fb",
  navy:"#1a2e4a",blue:"#3a72c4",blueBg:"#eaf1fb",
};

const CAREGIVERS = {
  grace:{
    name:"Grace Anderson",time:"8:00 AM",status:"Compliant",
    coord:"Matt",texted:"7:50 AM",called:"8:05 AM",review:"Yes",
    phone:"+1 (212) 345-6789",
  },
  liam:{
    name:"Liam Johnson",time:"9:00 AM",status:"Wrong location",
    coord:"Sara",texted:"8:50 AM",called:"9:05 AM",review:"Yes",
    phone:"+1 (312) 232-7554",
  },
};

const TH = ({ch}) => <th style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:500,color:C.muted,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",background:C.surface}}>{ch}</th>;
const TD = ({children,bold,muted,style:s={}}) => <td style={{padding:"14px 16px",color:muted?C.muted:C.text,fontWeight:bold?600:400,verticalAlign:"middle",...s}}>{children}</td>;

const Badge = ({color,children}) => {
  const m={amber:[C.amberBg,C.amber],green:[C.greenBg,C.green],blue:[C.blueBg,C.blue],purple:[C.purpleLight,C.purple],gray:["#f0f0ec",C.muted],red:[C.redBg,C.red]};
  const [bg,fg]=m[color]||m.gray;
  return <span style={{background:bg,color:fg,padding:"3px 8px",borderRadius:20,fontSize:11.5,fontWeight:500,whiteSpace:"nowrap",display:"inline-block"}}>{children}</span>;
};

// ── SMS Modal ────────────────────────────────────────────────────────────────
function SmsModal({ cgId, onClose }) {
  const cg = CAREGIVERS[cgId];
  const [msgs, setMsgs] = useState([]);
  const [phase, setPhase] = useState("ready"); // ready|sending|sent|waiting|replied
  const pollRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const outbound =
    `Hi ${cg.name.split(" ")[0]}, this is Alden 👋 ` +
    `You're scheduled to clock in at ${cg.time}. Please reply:\n\n` +
    `1 – Running late\n2 – Having technical issues\n3 – Forgot to clock in`;

  async function send() {
    setPhase("sending");

    try {
      // Tell server which caregiver is being texted
      await fetch("/api/track-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caregiverId: cgId }),
      });

      // Actually send the SMS via Twilio
      const res = await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caregiverId: cgId,
          caregiverName: cg.name,
          shiftTime: cg.time,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setMsgs([{ from: "us", text: outbound, ts: new Date() }]);
      setPhase("waiting");

      // Poll for reply every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/reply/${cgId}`);
          const d = await r.json();
          if (d.reply) {
            clearInterval(pollRef.current);
            setMsgs(m => [
              ...m,
              { from: "them", text: d.reply.text, ts: new Date(d.reply.ts) }
            ]);
            setPhase("replied");
          }
        } catch {}
      }, 3000);

    } catch (err) {
      alert(`Failed to send: ${err.message}`);
      setPhase("ready");
    }
  }

  const fmt = ts => ts instanceof Date
    ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const initials = cg.name.split(" ").map(n => n[0]).join("");

  const statusLabel = {
    ready: "Ready", sending: "Sending…",
    waiting: "Waiting for reply…", replied: "Replied ✓"
  }[phase];

  const statusColor = phase === "replied" ? "#28c840"
    : phase === "waiting" || phase === "sending" ? "#febc2e" : "#666";

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ width:400,background:C.surface,borderRadius:18,overflow:"hidden",boxShadow:"0 32px 100px rgba(0,0,0,.35)",display:"flex",flexDirection:"column",maxHeight:"82vh" }}>

        {/* Header */}
        <div style={{ background:C.navy,padding:"16px 18px",display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
          <div style={{ width:42,height:42,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"#fff",fontWeight:700,flexShrink:0 }}>{initials}</div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fff",fontWeight:600,fontSize:14 }}>{cg.name}</div>
            <div style={{ color:"rgba(255,255,255,.5)",fontSize:12 }}>{cg.phone}</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginRight:8 }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:statusColor }} />
            <span style={{ color:"rgba(255,255,255,.55)",fontSize:11.5 }}>{statusLabel}</span>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.12)",border:"none",color:"#fff",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex:1,overflowY:"auto",padding:16,background:"#ececea",display:"flex",flexDirection:"column",gap:12,minHeight:220 }}>
          {msgs.length === 0 && (
            <div style={{ textAlign:"center",color:C.muted,fontSize:13,margin:"auto",padding:24 }}>
              <div style={{ fontSize:36,marginBottom:10 }}>📱</div>
              Ready to text {cg.name.split(" ")[0]}<br />
              <span style={{ fontSize:12 }}>A real SMS will go to the demo phone</span>
            </div>
          )}

          {msgs.map((m, i) => {
            const isUs = m.from === "us";
            return (
              <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:isUs?"flex-end":"flex-start",gap:3 }}>
                {!isUs && (
                  <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,flexShrink:0 }}>{initials}</div>
                    <div style={{ maxWidth:"76%",background:"#fff",borderRadius:"14px 14px 14px 3px",padding:"10px 14px",fontSize:13.5,lineHeight:1.55,color:C.text,boxShadow:"0 1px 3px rgba(0,0,0,.1)",whiteSpace:"pre-wrap" }}>{m.text}</div>
                  </div>
                )}
                {isUs && (
                  <div style={{ maxWidth:"78%",background:"#4a7ef5",borderRadius:"14px 14px 3px 14px",padding:"10px 14px",fontSize:13,lineHeight:1.55,color:"#fff",whiteSpace:"pre-wrap" }}>{m.text}</div>
                )}
                <div style={{ fontSize:10.5,color:"#aaa",paddingLeft:isUs?0:36 }}>
                  {isUs ? "Alden" : cg.name.split(" ")[0]} · {fmt(m.ts)}
                </div>
              </div>
            );
          })}

          {phase === "waiting" && (
            <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
              <div style={{ width:28,height:28,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700 }}>{initials}</div>
              <div style={{ background:"#fff",borderRadius:"14px 14px 14px 3px",padding:"10px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.1)" }}>
                <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{ width:7,height:7,borderRadius:"50%",background:"#bbb",animation:`bounce 1.2s ease-in-out ${j*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0 }}>
          {phase === "ready" && (
            <button onClick={send} style={{ width:"100%",background:C.navy,color:"#fff",border:"none",borderRadius:9,padding:"11px 0",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = C.purple}
              onMouseLeave={e => e.currentTarget.style.background = C.navy}>
              📤 Send real SMS to demo phone
            </button>
          )}
          {phase === "sending" && (
            <div style={{ textAlign:"center",padding:"10px 0",fontSize:13,color:C.muted }}>Sending via Twilio…</div>
          )}
          {phase === "waiting" && (
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:C.amberBg,borderRadius:8,fontSize:13,fontWeight:500,color:C.amber }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"currentColor",flexShrink:0 }} />
              SMS delivered · waiting for reply on demo phone…
            </div>
          )}
          {phase === "replied" && (
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:C.greenBg,borderRadius:8,fontSize:13,fontWeight:500,color:C.green }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"currentColor",flexShrink:0 }} />
              Reply received and logged ✓
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

// ── Clock-in Screen ──────────────────────────────────────────────────────────
function ClockInScreen() {
  const [modal, setModal] = useState(null);

  const rows = [
    { id:"grace", ...CAREGIVERS.grace },
    { id:"liam",  ...CAREGIVERS.liam  },
    { name:"Ava Martinez",  time:"9:00 AM", status:"Compliant", coord:"Amra",  texted:"8:50 AM",      called:"9:05 AM", review:"—", id:null },
    { name:"Noah Brown",    time:"9:00 AM", status:"Compliant", coord:"Coral", texted:"8:50 AM",      called:"N/A",     review:"—", id:null },
    { name:"Sophia Davis",  time:"9:30 AM", status:"Compliant", coord:"Helen", texted:"Not yet sent", called:"N/A",     review:"—", id:null },
  ];

  return (
    <div>
      {modal && <SmsModal cgId={modal} onClose={() => setModal(null)} />}

      <h1 style={{ fontSize:26,fontWeight:600,color:C.navy,marginBottom:20 }}>Clock-in manager</h1>

      {/* Banner */}
      <div style={{ background:C.purpleLight,border:`1px solid ${C.purple}33`,borderRadius:10,padding:"12px 16px",marginBottom:22,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
        <div style={{ fontSize:13,color:C.purple,fontWeight:500,flex:1 }}>
          ✦ 2 caregivers need clock-in follow-up — send a real SMS now
        </div>
        <button onClick={() => setModal("grace")}
          style={{ background:C.purple,color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12.5,fontWeight:500,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6 }}
          onMouseEnter={e => e.currentTarget.style.opacity=".85"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}>
          💬 Text Grace
        </button>
        <button onClick={() => setModal("liam")}
          style={{ background:C.navy,color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12.5,fontWeight:500,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6 }}
          onMouseEnter={e => e.currentTarget.style.opacity=".85"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}>
          💬 Text Liam
        </button>
      </div>

      <h2 style={{ fontSize:16,fontWeight:600,color:C.navy,marginBottom:14 }}>Providers</h2>
      <div style={{ background:C.surface,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}` }}>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13.5 }}>
          <thead>
            <tr>{["Caregiver","Shift time","Real time compliance status","Coordinator ▾","Texted?","Called?","Needs Review?",""].map(h => <TH key={h} ch={h} />)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom:i<rows.length-1?`1px solid ${C.border}`:"none" }}>
                <TD bold>{r.name}</TD>
                <TD muted>{r.time}</TD>
                <TD><span style={{ color:r.status==="Compliant"?C.green:C.red,fontWeight:500 }}>{r.status}</span></TD>
                <TD>{r.coord}</TD>
                <TD muted={r.texted==="Not yet sent"}>{r.texted}</TD>
                <TD muted={r.called==="N/A"}>{r.called}</TD>
                <TD muted={r.review==="—"}>{r.review}</TD>
                <TD>
                  {r.id ? (
                    <button onClick={() => setModal(r.id)}
                      style={{ background:C.navy,color:"#fff",border:"none",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:12.5,fontWeight:500,fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,transition:"background .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background=C.purple}
                      onMouseLeave={e => e.currentTarget.style.background=C.navy}>
                      💬 Text
                    </button>
                  ) : (
                    <div style={{ display:"flex",gap:6 }}>
                      {["💬","📞"].map((ic,j) => <div key={j} style={{ width:30,height:30,border:`1px solid ${C.border}`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:C.muted }}>{ic}</div>)}
                    </div>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Scheduling Screen ────────────────────────────────────────────────────────
function SchedulingScreen({ onLisaClick }) {
  const rows=[
    {name:"Marcus Thompson",desc:"Client with Alzheimer's, dog at home",type:"purple",typeL:"Fill in",date:"Aug 7, 2:00 PM",coord:"Sarah",status:"green",statusL:"Approved",count:10,link:false},
    {name:"Lisa Reynolds",desc:"Client recovering from surgery, needs...",type:"gray",typeL:"Ongoing",date:"Aug 8, 8:00 AM",coord:"Mark",status:"blue",statusL:"Scheduled",count:5,link:true},
    {name:"John Carter",desc:"Client with mobility issues, lives alone",type:"gray",typeL:"Ongoing",date:"Aug 9, 10:00 AM",coord:"Emma",status:"blue",statusL:"Scheduled",count:0,link:false},
    {name:"Samantha Lee",desc:"Client with speech difficulties, require...",type:"purple",typeL:"Fill in",date:"Aug 10, 1:00 PM",coord:"David",status:"amber",statusL:"Needs review",count:14,link:false},
    {name:"David Johnson",desc:"Client with diabetes, dietary support...",type:"purple",typeL:"Fill in",date:"Aug 11, 11:00 AM",coord:"Jessica",status:"amber",statusL:"Needs review",count:8,link:false},
    {name:"Erica Simmons",desc:"Client with heart condition, home visit...",type:"purple",typeL:"Fill in",date:"Aug 12, 4:00 PM",coord:"Tom",status:"amber",statusL:"Needs review",count:11,link:false},
    {name:"Brian Wells",desc:"Client with depression, therapy sessi...",type:"purple",typeL:"Fill in",date:"Aug 13, 9:30 AM",coord:"Nina",status:"amber",statusL:"Needs review",count:25,link:false},
    {name:"Patricia Garcia",desc:"Client with PTSD, support group invol...",type:"purple",typeL:"Fill in",date:"Aug 14, 2:15 PM",coord:"Jim",status:"amber",statusL:"Needs review",count:4,link:false},
    {name:"Kevin Brown",desc:"Client with anxiety, coping strategies...",type:"purple",typeL:"Fill in",date:"Aug 15, 5:00 PM",coord:"Lisa",status:"amber",statusL:"Needs review",count:10,link:false},
    {name:"Nancy Davis",desc:"Client with vision impairment, require...",type:"purple",typeL:"Fill in",date:"Aug 16, 1:40 PM",coord:"Alex",status:"amber",statusL:"Needs review",count:2,link:false},
  ];
  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
        <h1 style={{ fontSize:26,fontWeight:600,color:C.navy,margin:0 }}>Case scheduling</h1>
        <button style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>All groups ▾</button>
      </div>
      <div style={{ display:"flex",gap:16,marginBottom:28 }}>
        {[{n:147,l:"📋 Cases",hero:true},{n:137,l:"👤 Clients"},{n:830,l:"🔗 Visits"}].map((s,i)=>(
          <div key={i} style={{ flex:1,background:s.hero?C.purple:C.surface,borderRadius:10,padding:"22px 24px",border:`1px solid ${s.hero?C.purple:C.border}` }}>
            <div style={{ fontSize:36,fontWeight:700,lineHeight:1,marginBottom:8,color:s.hero?"#fff":C.text }}>{s.n}</div>
            <div style={{ fontSize:12.5,color:s.hero?"rgba(255,255,255,.7)":C.muted }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ background:C.surface,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}` }}>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13.5 }}>
          <thead><tr>{["Name","Description","Type","Start date","Group","Status","Interested"].map(h=><TH key={h} ch={h}/>)}</tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} onClick={r.link?onLisaClick:undefined} style={{ borderBottom:i<rows.length-1?`1px solid ${C.border}`:"none",cursor:r.link?"pointer":"default" }}
                onMouseEnter={e=>e.currentTarget.style.background="#fafaf8"}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <TD bold><span style={r.link?{color:C.purple,textDecoration:"underline"}:{}}>{r.name}</span></TD>
                <TD muted>{r.desc}</TD>
                <TD><Badge color={r.type}>{r.typeL}</Badge></TD>
                <TD>{r.date}</TD>
                <TD>Coordinator <strong>{r.coord}</strong></TD>
                <TD><Badge color={r.status}>{r.statusL}</Badge></TD>
                <TD><span style={{color:r.count?C.green:C.muted,fontWeight:r.count?500:400}}>{r.count?`● ${r.count}`:"0"}</span></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Lisa Screen ──────────────────────────────────────────────────────────────
function LisaScreen({ onBack }) {
  const [open, setOpen] = useState(false);
  const providers=[
    {name:"Mia Carter",phone:"(240) 342-4536",gender:"Female",dist:"1.2 mi",addr:"22 13 St., Rockville, MD 20847",int:true,fam:true,filled:true},
    {name:"Sarah Mitchell",phone:"(415) 574-6853",gender:"Female",dist:"2.5 mi",addr:"789 Oak Dr., Rockville, MD 20847",int:true,fam:false,filled:false},
    {name:"Grace Anderson",phone:"(212) 345-6789",gender:"Female",dist:"3.1 mi",addr:"321 Pine St., Boyds, MD 20841",int:true,fam:true,filled:false},
    {name:"Sophia Davis",phone:"(646) 987-6543",gender:"Female",dist:"4.5 mi",addr:"654 Elm St., Boyds, MD 20841",int:false,fam:false,filled:false},
    {name:"Ethan Wilson",phone:"(718) 123-4567",gender:"Male",dist:"1.9 mi",addr:"97 Cedar Ave., Rockville, MD 20847",int:true,fam:false,filled:false},
    {name:"Liam Johnson",phone:"(312) 232-7554",gender:"Male",dist:"0.8 mi",addr:"456 Maple Ave., Boyds, MD 20841",int:false,fam:false,filled:false},
  ];
  const logs=[
    {title:"AI calls to Mia Carter",tags:[{l:"1 voicemail",bg:"#fff3e0",fg:"#c97c1a"}]},
    {title:"AI calls to Sarah Mitchell",tags:[{l:"1 talked",bg:"#f0f0ec",fg:C.muted},{l:"Not interested",bg:C.redBg,fg:C.red}]},
    {title:"Agent logs memory for future reference",note:'"Preference: Injured. Not available on Thursdays for next 2 months."'},
    {title:"AI calls to Grace Anderson",tags:[{l:"1 talked",bg:"#f0f0ec",fg:C.muted},{l:"Interested",bg:C.greenBg,fg:C.green}]},
  ];
  const VY=()=><span style={{display:"inline-flex",alignItems:"center",gap:5,color:C.purple,fontSize:13,fontWeight:500}}><span style={{width:18,height:18,background:C.purple,color:"#fff",borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</span>Yes</span>;

  return (
    <div style={{ position:"relative",height:"100%",overflow:"hidden" }}>
      <div style={{ height:"100%",overflowY:"auto",padding:"32px 36px" }}>
        <div onClick={onBack} style={{ fontSize:13,color:C.muted,cursor:"pointer",marginBottom:4,display:"inline-block" }}>← Back</div>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
          <h1 style={{ fontSize:26,fontWeight:600,color:C.navy,margin:0 }}>Lisa Reynolds</h1>
          <button onClick={()=>setOpen(true)} style={{ marginLeft:"auto",fontSize:12.5,fontWeight:500,cursor:"pointer",color:open?"#fff":C.purple,background:open?C.purple:C.purpleLight,border:`1px solid ${open?C.purple:C.purpleLight}`,borderRadius:7,padding:"5px 12px",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5 }}>✦ Agent log</button>
        </div>
        <div style={{ display:"flex",gap:10,marginBottom:28,flexWrap:"wrap" }}>
          {["♀ Female","📅 Thu 8 AM – 3 PM","📍 320 East St., Rockville, Maryland","🧠 Early Dementia"].map(c=><span key={c} style={{ fontSize:12.5,color:C.muted,background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 12px" }}>{c}</span>)}
        </div>
        <h2 style={{ fontSize:16,fontWeight:600,color:C.navy,marginBottom:16 }}>Matching providers</h2>
        <div style={{ display:"flex",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:24 }}>
          {[{n:48,l:"👤 Providers matched"},{n:12,l:"✓ Interested providers"},{n:22,l:"↺ Familiar providers"}].map((s,i)=>(
            <div key={i} style={{ flex:1,padding:"20px 24px",borderRight:i<2?`1px solid ${C.border}`:"none" }}>
              <div style={{ fontSize:32,fontWeight:700,color:C.navy,lineHeight:1,marginBottom:8 }}>{s.n}</div>
              <div style={{ fontSize:12,color:C.muted }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ background:C.surface,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}` }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13.5 }}>
            <thead><tr>{["Caregiver Name","Phone number","Gender","Distance","Address","Interested","Familiar",""].map(h=><TH key={h} ch={h}/>)}</tr></thead>
            <tbody>
              {providers.map((p,i)=>(
                <tr key={i} style={{ borderBottom:i<providers.length-1?`1px solid ${C.border}`:"none" }}>
                  <TD bold>{p.name}</TD><TD muted>{p.phone}</TD><TD>{p.gender}</TD>
                  <TD>▼ {p.dist}</TD><TD muted>{p.addr}</TD>
                  <TD>{p.int?<VY/>:<span style={{color:C.muted}}>—</span>}</TD>
                  <TD>{p.fam?<VY/>:<span style={{color:C.muted}}>—</span>}</TD>
                  <TD><div style={{display:"flex",gap:6}}>{["💬","📞"].map((ic,j)=><div key={j} style={{width:30,height:30,border:`1px solid ${p.filled?C.navy:C.border}`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:p.filled?"#fff":C.muted,background:p.filled?C.navy:C.surface}}>{ic}</div>)}</div></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open&&<div onClick={()=>setOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.15)",zIndex:10}}/>}
      <div style={{position:"absolute",top:0,right:0,bottom:0,width:272,background:C.surface,borderLeft:`1px solid ${C.border}`,boxShadow:"-8px 0 32px rgba(0,0,0,.1)",zIndex:11,overflowY:"auto",padding:20,transform:open?"translateX(0)":"translateX(100%)",transition:"transform .25s ease"}}>
        <div style={{width:56,height:44,background:"linear-gradient(135deg,#c8d8f0,#e8e0f8)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 14px"}}>🌤️</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:14,borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
          <div style={{fontSize:14,fontWeight:600,color:C.navy}}>Agent logs</div>
          <button onClick={()=>setOpen(false)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:13,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
        </div>
        {logs.map((e,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"14px 0",borderBottom:i<logs.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.purple,marginTop:5,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:C.navy,marginBottom:6,lineHeight:1.4}}>{e.title}</div>
              {e.tags&&<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{e.tags.map((t,j)=><span key={j} style={{background:t.bg,color:t.fg,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:20}}>{t.l}</span>)}</div>}
              {e.note&&<div style={{fontSize:11.5,color:C.muted,background:C.bg,borderRadius:6,padding:"6px 9px",lineHeight:1.5,borderLeft:`2px solid ${C.border}`,marginTop:6}}>{e.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
const NAV=[{label:"Home",icon:"⌂",id:"home"},{label:"Scheduling",icon:"📅",id:"scheduling"},{label:"Compliance",icon:"⊙",id:"compliance"},{label:"Client Engagement",icon:"◎",id:"engagement"},{label:"Clock-in manager",icon:"◷",id:"clockin"},{label:"Call logs",icon:"☎",id:"calls"}];
const URLS={clockin:"app.alden.health/clock-in-manager",scheduling:"app.alden.health/scheduling",lisa:"app.alden.health/scheduling/lisa-reynolds"};

export default function App() {
  const [screen, setScreen] = useState("clockin");
  const activeNav = screen === "lisa" ? "scheduling" : screen;

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif",background:"#1a1a1a",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ width:"100%",maxWidth:1320,background:"#2a2a2a",borderRadius:12,overflow:"hidden",boxShadow:"0 40px 120px rgba(0,0,0,.6)" }}>
        <div style={{ background:"#3a3a3a",padding:"10px 16px",display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ display:"flex",gap:6 }}>{["#ff5f57","#febc2e","#28c840"].map(c=><span key={c} style={{width:12,height:12,borderRadius:"50%",background:c,display:"inline-block"}}/>)}</div>
          <div style={{ background:"#2a2a2a",borderRadius:6,padding:"4px 12px",fontSize:12,color:"#888",fontFamily:"monospace",maxWidth:480 }}>{URLS[screen]||"app.alden.health"}</div>
        </div>
        <div style={{ display:"flex",height:780,background:C.bg,overflow:"hidden" }}>
          <aside style={{ width:200,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,padding:"0 20px 24px",fontSize:18,fontWeight:600,color:C.navy }}>
              <div style={{ width:28,height:28,background:C.navy,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14 }}>⊕</div>Alden
            </div>
            <nav style={{ flex:1 }}>
              {NAV.map(item=>(
                <div key={item.id} onClick={()=>setScreen(item.id)} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 20px",fontSize:13.5,color:activeNav===item.id?C.navy:C.muted,cursor:"pointer",fontWeight:activeNav===item.id?500:400,position:"relative",transition:"background .1s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {activeNav===item.id&&<div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:3,height:20,background:C.purple,borderRadius:"0 3px 3px 0"}}/>}
                  <span style={{fontSize:15,width:18,textAlign:"center"}}>{item.icon}</span>{item.label}
                  {activeNav===item.id&&<div style={{width:8,height:8,borderRadius:"50%",background:C.purple,marginLeft:"auto"}}/>}
                </div>
              ))}
            </nav>
            <div style={{ padding:"16px 0",borderTop:`1px solid ${C.border}` }}>
              {[{label:"Settings",icon:"⚙"},{label:"Help & Support",icon:"❓"}].map(item=>(
                <div key={item.label} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 20px",fontSize:13.5,color:C.muted,cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontSize:15,width:18,textAlign:"center"}}>{item.icon}</span>{item.label}
                </div>
              ))}
            </div>
          </aside>
          <main style={{ flex:1,overflow:"hidden",position:"relative" }}>
            {screen==="clockin"&&<div style={{position:"absolute",inset:0,overflowY:"auto",padding:"32px 36px",background:C.bg}}><ClockInScreen/></div>}
            {screen==="scheduling"&&<div style={{position:"absolute",inset:0,overflowY:"auto",padding:"32px 36px",background:C.bg}}><SchedulingScreen onLisaClick={()=>setScreen("lisa")}/></div>}
            {screen==="lisa"&&<div style={{position:"absolute",inset:0,background:C.bg}}><LisaScreen onBack={()=>setScreen("scheduling")}/></div>}
            {!["clockin","scheduling","lisa"].includes(screen)&&<div style={{position:"absolute",inset:0,overflowY:"auto",padding:"32px 36px",background:C.bg}}><h1 style={{fontSize:26,fontWeight:600,color:C.navy,marginBottom:8}}>{screen.charAt(0).toUpperCase()+screen.slice(1)}</h1><p style={{color:C.muted}}>Coming soon.</p></div>}
          </main>
        </div>
      </div>
    </div>
  );
}
