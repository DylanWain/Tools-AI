import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Subscribe() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setSuccess(true);
      const em = params.get('email') || '';
      if (em) fetchKey(em);
    }
  }, []);

  async function fetchKey(em: string) {
    const { data } = await supabase
      .from('tai_keys')
      .select('api_key')
      .eq('user_email', em)
      .eq('active', true)
      .single();
    if (data) setApiKey(data.api_key);
  }

  async function handleSubscribe() {
    if (!email || !email.includes('@')) { setError('Enter a valid email'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || 'Something went wrong');
    } catch { setError('Connection failed'); }
    setLoading(false);
  }

  async function handleLookup() {
    if (!lookupEmail || !lookupEmail.includes('@')) { setError('Enter your email'); return; }
    setLookupLoading(true); setError('');
    await fetchKey(lookupEmail);
    setLookupLoading(false);
    if (!apiKey) setError('No active key found for that email. Check your email or subscribe below.');
  }

  function copy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ maxWidth:'480px', width:'100%' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ fontSize:'32px', marginBottom:'8px' }}>⚡</div>
          <h1 style={{ color:'#fff', fontSize:'24px', fontWeight:'700', margin:'0 0 8px' }}>Tools AI</h1>
          <p style={{ color:'#888', fontSize:'14px', margin:0 }}>VS Code Extension — $25/month</p>
        </div>

        {success && apiKey ? (
          /* ── SUCCESS: show key ── */
          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'28px' }}>
            <div style={{ textAlign:'center', marginBottom:'24px' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
              <h2 style={{ color:'#fff', fontSize:'18px', fontWeight:'600', margin:'0 0 8px' }}>You're all set!</h2>
              <p style={{ color:'#888', fontSize:'13px', margin:0 }}>Copy your API key and paste it into the VS Code extension settings.</p>
            </div>
            <div style={{ background:'#111', border:'1px solid #333', borderRadius:'8px', padding:'12px 14px', marginBottom:'12px' }}>
              <div style={{ color:'#aaa', fontSize:'10px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Your API Key</div>
              <div style={{ color:'#50d080', fontFamily:'monospace', fontSize:'12px', wordBreak:'break-all' }}>{apiKey}</div>
            </div>
            <button onClick={copy} style={{ width:'100%', padding:'12px', background: copied ? '#1a4a2a' : '#1a3a2a', border:'1px solid '+(copied?'#50d080':'#2a4a3a'), borderRadius:'8px', color: copied?'#50d080':'#888', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
              {copied ? '✓ Copied!' : 'Copy Key'}
            </button>
            <p style={{ color:'#555', fontSize:'11px', textAlign:'center', marginTop:'16px' }}>Open VS Code → Tools AI sidebar → ⚙️ Settings → paste your key</p>
          </div>

        ) : success && !apiKey ? (
          /* ── SUCCESS but key not ready yet ── */
          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'28px', textAlign:'center' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
            <h2 style={{ color:'#fff', fontSize:'18px', fontWeight:'600', margin:'0 0 8px' }}>Payment confirmed!</h2>
            <p style={{ color:'#888', fontSize:'13px' }}>Your key is being generated. Enter your email to retrieve it.</p>
            <input value={lookupEmail} onChange={e=>setLookupEmail(e.target.value)} placeholder="your@email.com" style={{ width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #333', borderRadius:'8px', color:'#fff', fontSize:'13px', marginTop:'16px', marginBottom:'8px', fontFamily:'inherit', outline:'none' }} />
            <button onClick={handleLookup} disabled={lookupLoading} style={{ width:'100%', padding:'11px', background:'#1a3a2a', border:'1px solid #2a4a3a', borderRadius:'8px', color:'#50d080', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
              {lookupLoading ? 'Looking up…' : 'Get My Key'}
            </button>
            {error && <p style={{ color:'#e05050', fontSize:'12px', marginTop:'8px' }}>{error}</p>}
          </div>

        ) : (
          /* ── SUBSCRIBE FORM ── */
          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'28px' }}>

            {/* Features */}
            <div style={{ marginBottom:'24px' }}>
              {['All 5 models: GPT-4o, Claude, Gemini, Grok, Perplexity','Multi-model orchestration with shared context','Stream responses in real time','Cancel anytime'].map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <span style={{ color:'#50d080', fontSize:'14px', flexShrink:0 }}>✓</span>
                  <span style={{ color:'#ccc', fontSize:'13px' }}>{f}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop:'1px solid #2a2a2a', paddingTop:'20px' }}>
              <input
                value={email}
                onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleSubscribe()}
                placeholder="your@email.com"
                style={{ width:'100%', padding:'11px 12px', background:'#111', border:'1px solid #333', borderRadius:'8px', color:'#fff', fontSize:'13px', marginBottom:'10px', fontFamily:'inherit', outline:'none' }}
              />
              {error && <p style={{ color:'#e05050', fontSize:'12px', margin:'0 0 8px' }}>{error}</p>}
              <button onClick={handleSubscribe} disabled={loading} style={{ width:'100%', padding:'12px', background:'#007AFF', border:'none', borderRadius:'8px', color:'#fff', fontSize:'14px', fontWeight:'600', cursor:loading?'default':'pointer', opacity:loading?0.7:1, fontFamily:'inherit' }}>
                {loading ? 'Redirecting…' : 'Subscribe — $25/month'}
              </button>
              <p style={{ color:'#555', fontSize:'11px', textAlign:'center', marginTop:'12px' }}>Secure payment via Stripe. Cancel anytime.</p>
            </div>

            {/* Already subscribed? */}
            <div style={{ borderTop:'1px solid #1a1a1a', marginTop:'20px', paddingTop:'16px' }}>
              <p style={{ color:'#666', fontSize:'11px', textAlign:'center', marginBottom:'8px' }}>Already subscribed? Get your key:</p>
              <div style={{ display:'flex', gap:'6px' }}>
                <input value={lookupEmail} onChange={e=>setLookupEmail(e.target.value)} placeholder="your@email.com" style={{ flex:1, padding:'8px 10px', background:'#111', border:'1px solid #2a2a2a', borderRadius:'6px', color:'#aaa', fontSize:'12px', fontFamily:'inherit', outline:'none' }} />
                <button onClick={handleLookup} disabled={lookupLoading} style={{ padding:'8px 12px', background:'#1a1a1a', border:'1px solid #333', borderRadius:'6px', color:'#888', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' }}>
                  {lookupLoading?'…':'Get Key'}
                </button>
              </div>
              {apiKey && (
                <div style={{ marginTop:'10px', background:'#111', border:'1px solid #2a4a3a', borderRadius:'6px', padding:'10px' }}>
                  <div style={{ color:'#50d080', fontFamily:'monospace', fontSize:'11px', wordBreak:'break-all', marginBottom:'6px' }}>{apiKey}</div>
                  <button onClick={copy} style={{ background:'none', border:'none', color:'#50d080', fontSize:'11px', cursor:'pointer', padding:0 }}>{copied?'✓ Copied':'Copy'}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
