"use client";
import { useState, useRef, useEffect } from "react";
import { DEPARTMENTS, groupedDepts, getDept } from "@/lib/departments";
import type { DeptId } from "@/lib/departments";

type Msg = { role: "user" | "assistant"; content: string; files?: FileAttach[] };
type FileAttach = { name: string; mimeType: string; base64: string; previewUrl?: string };
type HistoryItem = { id: string; dept_id: string; title: string; updated_at: string; user_name?: string };

function md(text: string) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/`([^`]+)`/g,"<code>$1</code>")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^- (.+)$/gm,"<li>$1</li>")
    .replace(/(<li>[^<]*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`)
    .replace(/\n\n/g,"</p><p>")
    .replace(/\n/g,"<br>");
}

const HINTS: Record<string, string[]> = {
  "gfs-general": ["コンプライアンス上NGな表現を教えて","共通カラーコードは？","セミナーURLを確認したい"],
  "quality-check": ["この文面のFBをして","このコピーどう思う？"],
  "bunzemi-mail": ["NVIDIA決算絡みで体験会誘引メールを作って","件名だけ3案出して","卒業生向けメールを作って"],
  "bunzemi-design": ["バナーサイズの仕様を教えて"],
  "bunzemi-lp": ["LPの改善点を教えて","FAQ案を出して"],
  "bunzemi-plan": ["体験会申込率を上げる施策を考えて"],
  "kobetsu-mail": ["個別株ゼミ体験会の案内メールを作って"],
  "kobetsu-design": ["バナー仕様を確認したい"],
  "kobetsu-plan": ["ブンゼミからの誘引施策を考えて"],
};

export default function Home() {
  const [deptId, setDeptId] = useState<DeptId>("gfs-general");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(() => crypto.randomUUID());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [kwRefs, setKwRefs] = useState<string[]>([]);
  const [attached, setAttached] = useState<FileAttach[]>([]);
  const [tick, setTick] = useState(0);
  const [userName, setUserName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dept = getDept(deptId);
  const groups = groupedDepts();

  useEffect(() => {
    const saved = localStorage.getItem("gfs_user_name");
    if (saved) setUserName(saved);
    else setShowNameModal(true);
  }, []);

  useEffect(() => {
    fetch("/api/conversations").then(r=>r.json()).then(d=>setHistory(d.conversations??[]));
  }, [convId, tick]);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, loading]);

  const saveName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem("gfs_user_name", name);
    setUserName(name);
    setShowNameModal(false);
  };

  const newChat = (id?: DeptId) => {
    setMsgs([]); setConvId(crypto.randomUUID()); setKwRefs([]); setAttached([]);
    if (id) setDeptId(id);
  };

  const loadConv = async (id: string) => {
    const r = await fetch(`/api/conversations/${id}`);
    const d = await r.json();
    if (d.conversation) { setMsgs(d.conversation.messages); setDeptId(d.conversation.dept_id); setConvId(id); }
  };

  const exportConv = () => {
    if (msgs.length === 0) return;
    const lines = [`# ${dept.name} - 会話ログ`, `**ユーザー:** ${userName || "不明"}`, `**日時:** ${new Date().toLocaleString("ja-JP")}`, "---", ""];
    msgs.forEach(m => {
      lines.push(`**${m.role === "user" ? (userName || "ユーザー") : "AI秘書"}:**`);
      lines.push(m.content);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], {type: "text/markdown"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `会話_${dept.name}_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files??[]).forEach(f => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAttached(prev => [...prev, {
          name: f.name, mimeType: f.type,
          base64: result.split(",")[1],
          previewUrl: f.type.startsWith("image/") ? result : undefined,
        }]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && attached.length === 0) || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    const files = [...attached];
    setAttached([]);

    const newMsgs: Msg[] = [...msgs, { role: "user", content: text, files }];
    setMsgs(newMsgs);
    setLoading(true);
    setKwRefs([]);

    let kwCtx = "";
    if (text) {
      const kw = await fetch(`/api/knowledge?q=${encodeURIComponent(text)}&dept=${deptId}`).then(r=>r.json());
      const refs = kw.results ?? [];
      if (refs.length) {
        setKwRefs(refs.map((r: {title:string}) => r.title));
        kwCtx = refs.map((r: {title:string;content:string}) => `【${r.title}】\n${r.content.slice(0,600)}`).join("\n\n---\n\n");
      }
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ messages: newMsgs.map(m=>({role:m.role,content:m.content})), deptId, conversationId: convId, knowledgeContext: kwCtx||null, files, userName }),
    });

    if (!res.ok) {
      const err = await res.text();
      setMsgs(prev => [...prev, {role:"assistant", content:`⚠️ ${err}`}]);
      setLoading(false);
      return;
    }

    setMsgs(prev => [...prev, {role:"assistant", content:""}]);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acc = "";
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      acc += dec.decode(value, {stream:true});
      setMsgs(prev => { const u=[...prev]; u[u.length-1]={role:"assistant",content:acc}; return u; });
    }
    setLoading(false);
    setTick(t=>t+1);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key==="Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160)+"px";
  };

  const S = {
    app: {display:"flex",height:"100dvh",overflow:"hidden"} as React.CSSProperties,
    side: {width:"var(--sidebar)",flexShrink:0,background:"var(--navy)",display:"flex",flexDirection:"column" as const,overflow:"hidden"},
    main: {flex:1,display:"flex",flexDirection:"column" as const,overflow:"hidden",background:"var(--bg)"},
  };

  return (
    <div style={S.app}>
      {/* Name modal */}
      {showNameModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"var(--surface)",borderRadius:"var(--r-lg)",padding:"32px",width:320,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:12}}>👋</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6,textAlign:"center"}}>はじめに名前を教えてください</div>
            <div style={{fontSize:13,color:"var(--text2)",marginBottom:20,textAlign:"center"}}>会話ログに記録されます</div>
            <input
              value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&saveName()}
              placeholder="例：小川、田中"
              autoFocus
              style={{width:"100%",padding:"10px 12px",border:"1.5px solid var(--border)",borderRadius:"var(--r-md)",fontSize:14,outline:"none",boxSizing:"border-box" as const,fontFamily:"inherit"}}
            />
            <button onClick={saveName} disabled={!nameInput.trim()} style={{width:"100%",marginTop:12,padding:"10px",background:"var(--navy)",color:"#fff",border:"none",borderRadius:"var(--r-md)",fontSize:14,fontWeight:600,cursor:nameInput.trim()?"pointer":"default",opacity:nameInput.trim()?1:0.5}}>
              開始する
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside style={S.side}>
        <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{fontSize:17,fontWeight:700,color:"#fff",letterSpacing:"0.05em"}}>GFS AI秘書</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>バリューアップ部</div>
          {userName && (
            <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"var(--navy)",fontWeight:700}}>{userName[0]}</div>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>{userName}</span>
              <button onClick={()=>{setNameInput(userName);setShowNameModal(true);}} style={{marginLeft:"auto",background:"none",border:"none",color:"rgba(255,255,255,0.35)",fontSize:11,cursor:"pointer"}}>変更</button>
            </div>
          )}
        </div>
        <button onClick={()=>newChat()} style={{margin:"10px 10px 4px",padding:"8px 12px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.4)",borderRadius:"var(--r-md)",color:"var(--gold-l)",fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:15}}>＋</span> 新しいチャット
        </button>
        <nav style={{flex:1,overflowY:"auto",padding:"4px 6px 12px"}}>
          {Object.entries(groups).map(([group, depts]) => (
            <div key={group} style={{marginTop:10}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",padding:"0 8px 4px",letterSpacing:"0.08em",textTransform:"uppercase"}}>{group}</div>
              {depts.map(d => (
                <button key={d.id} onClick={()=>{ setDeptId(d.id); newChat(d.id); }} style={{width:"100%",textAlign:"left",padding:"7px 10px",background:deptId===d.id?"rgba(255,255,255,0.12)":"transparent",border:deptId===d.id?"1px solid rgba(255,255,255,0.15)":"1px solid transparent",borderRadius:"var(--r-sm)",color:deptId===d.id?"#fff":"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:7,marginBottom:1}}>
                  <span>{d.icon}</span>
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                </button>
              ))}
            </div>
          ))}
          {history.length > 0 && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",padding:"0 8px 4px",letterSpacing:"0.08em",textTransform:"uppercase"}}>最近の会話</div>
              {history.slice(0,15).map(h => {
                const d = DEPARTMENTS.find(dep=>dep.id===h.dept_id);
                return (
                  <button key={h.id} onClick={()=>loadConv(h.id)} style={{width:"100%",textAlign:"left",padding:"5px 10px",background:"transparent",border:"1px solid transparent",borderRadius:"var(--r-sm)",cursor:"pointer",color:"rgba(255,255,255,0.5)",fontSize:12,display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
                    <span style={{fontSize:12}}>{d?.icon??"💬"}</span>
                    <div style={{flex:1,overflow:"hidden"}}>
                      <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.title}</div>
                      {h.user_name && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{h.user_name}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <div style={{background:"var(--surface)",borderBottom:"1px solid var(--border)",padding:"10px 20px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{dept.icon}</span>
          <div>
            <div style={{fontSize:14,fontWeight:600}}>{dept.name}</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>{dept.group}</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            {msgs.length > 0 && (
              <button onClick={exportConv} title="会話をMarkdownでエクスポート" style={{padding:"5px 12px",background:"transparent",border:"1px solid var(--border)",borderRadius:"var(--r-sm)",fontSize:12,color:"var(--text2)",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                ⬇ エクスポート
              </button>
            )}
            <div style={{fontSize:12,color:"var(--text3)",display:"flex",alignItems:"center",gap:5}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#16a34a",display:"inline-block"}}/>
              Obsidianと同期中
            </div>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"24px 20px"}}>
          {msgs.length === 0 && (
            <div style={{textAlign:"center",paddingTop:60}}>
              <div style={{fontSize:48,marginBottom:12}}>{dept.icon}</div>
              <div style={{fontSize:20,fontWeight:600,marginBottom:6}}>{dept.name}</div>
              <div style={{fontSize:14,color:"var(--text2)",marginBottom:32}}>{dept.desc}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                {(HINTS[deptId]??[]).map(h => (
                  <button key={h} onClick={()=>{setInput(h);taRef.current?.focus();}} style={{padding:"8px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,fontSize:13,color:"var(--text2)",cursor:"pointer"}}>{h}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:16,gap:10,alignItems:"flex-start"}}>
              {m.role==="assistant" && (
                <div style={{width:30,height:30,borderRadius:"50%",background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"var(--gold-l)",flexShrink:0,marginTop:2}}>秘</div>
              )}
              <div style={{maxWidth:"72%"}}>
                {m.role==="user" && userName && (
                  <div style={{fontSize:11,color:"var(--text3)",textAlign:"right",marginBottom:3}}>{userName}</div>
                )}
                <div style={{padding:"10px 14px",background:m.role==="user"?"var(--navy)":"var(--surface)",color:m.role==="user"?"#fff":"var(--text)",borderRadius:m.role==="user"?"var(--r-lg) var(--r-lg) 4px var(--r-lg)":"var(--r-lg) var(--r-lg) var(--r-lg) 4px",border:m.role==="assistant"?"1px solid var(--border)":"none",fontSize:14,lineHeight:1.7}}>
                  {m.files?.length ? (
                    <div style={{marginBottom:8,display:"flex",flexWrap:"wrap",gap:6}}>
                      {m.files.map((f,fi) => f.previewUrl
                        ? <img key={fi} src={f.previewUrl} alt={f.name} style={{maxWidth:200,maxHeight:150,borderRadius:"var(--r-sm)",objectFit:"cover"}}/>
                        : <div key={fi} style={{background:"rgba(255,255,255,0.15)",padding:"3px 9px",borderRadius:"var(--r-sm)",fontSize:12}}>📎 {f.name}</div>
                      )}
                    </div>
                  ) : null}
                  {m.role==="assistant"
                    ? <div className="prose" dangerouslySetInnerHTML={{__html: md(m.content)}}/>
                    : <span style={{whiteSpace:"pre-wrap"}}>{m.content}</span>
                  }
                  {m.role==="assistant" && i===msgs.length-1 && kwRefs.length>0 && (
                    <div style={{marginTop:8,paddingTop:6,borderTop:"1px solid var(--border)",fontSize:11,color:"var(--text3)",display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      <span>参照：</span>
                      {kwRefs.map(r=><span key={r} style={{background:"var(--blue-bg)",color:"var(--blue)",padding:"1px 7px",borderRadius:10}}>{r}</span>)}
                    </div>
                  )}
                </div>
              </div>
              {m.role==="user" && (
                <div style={{width:30,height:30,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--navy)",fontWeight:700,flexShrink:0,marginTop:2}}>{userName?userName[0]:"人"}</div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:16}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"var(--gold-l)",flexShrink:0}}>秘</div>
              <div style={{padding:"12px 16px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r-lg) var(--r-lg) var(--r-lg) 4px",display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=><span key={i} style={{width:7,height:7,borderRadius:"50%",background:"var(--text3)",display:"inline-block",animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{background:"var(--surface)",borderTop:"1px solid var(--border)",padding:"12px 20px"}}>
          {attached.length > 0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
              {attached.map((f,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--r-sm)",padding:"4px 8px",fontSize:12}}>
                  {f.previewUrl ? <img src={f.previewUrl} alt={f.name} style={{width:28,height:28,objectFit:"cover",borderRadius:3}}/> : <span>📎</span>}
                  <span style={{color:"var(--text2)",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                  <button onClick={()=>setAttached(prev=>prev.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:14,padding:0,lineHeight:1}}>✕</button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.csv" onChange={onFile} style={{display:"none"}}/>
          <div style={{display:"flex",gap:8,alignItems:"flex-end",background:"var(--bg)",border:"1.5px solid var(--border)",borderRadius:"var(--r-lg)",padding:"8px 8px 8px 12px"}}>
            <button onClick={()=>fileRef.current?.click()} title="ファイル添付" style={{width:32,height:32,borderRadius:"var(--r-sm)",background:"transparent",border:"1px solid var(--border)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:16,flexShrink:0}}>📎</button>
            <textarea ref={taRef} value={input} onChange={onInput} onKeyDown={onKey} placeholder={`${dept.name}に質問・依頼する…（Enterで送信、Shift+Enterで改行）`} rows={1} style={{flex:1,background:"transparent",border:"none",outline:"none",resize:"none",fontSize:14,color:"var(--text)",lineHeight:1.6,fontFamily:"inherit",overflowY:"hidden",maxHeight:160}}/>
            <button onClick={send} disabled={(!input.trim()&&attached.length===0)||loading} style={{width:36,height:36,borderRadius:"50%",background:(input.trim()||attached.length>0)&&!loading?"var(--navy)":"var(--border)",border:"none",cursor:(input.trim()||attached.length>0)&&!loading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:18,transition:"background 0.15s"}}>↑</button>
          </div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:6,textAlign:"center"}}>会話内容はSupabaseに自動保存されます</div>
        </div>
      </main>
      <style>{`button:hover{opacity:.9}textarea::placeholder{color:var(--text3)}`}</style>
    </div>
  );
}
