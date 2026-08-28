import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSecondaryListings, purchaseSecondaryListing, type SecondaryListing } from '../lib/secondaryMarket';

type Performance = {
  paid: number; onTime: number; late: number; missed: number;
  nextDate?: string; nextAmount?: number; expectedRemaining?: number;
};

const money = (n: unknown) => Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const pct = (n: unknown) => Number.isFinite(Number(n)) ? `${Number(n).toFixed(2)}%` : '—';

export default function SecondaryMarket() {
  const [rows, setRows] = useState<SecondaryListing[]>([]);
  const [performance, setPerformance] = useState<Record<number, Performance>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function refresh() {
    try {
      const listings = await loadSecondaryListings();
      setRows(listings);
      if (!supabase || !listings.length) return;
      const loanNumbers = [...new Set(listings.map(r => Number(r.loan_number)))];
      const [{ data: schedules }, { data: loans }] = await Promise.all([
        supabase.from('loan_payment_schedule').select('loan_number,due_date,expected_principal,expected_interest,expected_total,status,paid_at').in('loan_number', loanNumbers).order('due_date'),
        supabase.from('loan_applications').select('loan_number,loan_amount').in('loan_number', loanNumbers),
      ]);
      const loanAmount = new Map((loans || []).map((l: any) => [Number(l.loan_number), Number(l.loan_amount || 0)]));
      const next: Record<number, Performance> = {};
      for (const listing of listings) {
        const ln = Number(listing.loan_number);
        const items = (schedules || []).filter((s: any) => Number(s.loan_number) === ln);
        const paid = items.filter((s: any) => s.status === 'paid');
        const onTime = paid.filter((s: any) => s.paid_at && new Date(s.paid_at).getTime() <= new Date(`${s.due_date}T23:59:59`).getTime()).length;
        const latePaid = paid.length - onTime;
        const missed = items.filter((s: any) => s.status === 'missed' || s.status === 'late').length;
        const upcoming = items.find((s: any) => ['upcoming','due','partial','late'].includes(s.status));
        const totalLoan = loanAmount.get(ln) || Number(listing.original_principal) || 1;
        const share = Math.min(1, Number(listing.original_principal) / totalLoan);
        const remainingInterest = items.filter((s: any) => s.status !== 'paid' && s.status !== 'waived')
          .reduce((sum: number, s: any) => sum + Number(s.expected_interest || 0) * share, 0);
        next[ln] = {
          paid: paid.length, onTime, late: latePaid, missed,
          nextDate: upcoming?.due_date,
          nextAmount: upcoming ? Number(upcoming.expected_total || 0) * share : undefined,
          expectedRemaining: Number(listing.current_principal) + remainingInterest,
        };
      }
      setPerformance(next);
    } catch (err: any) { setMsg(err?.message || 'Unable to load secondary market.'); }
  }

  useEffect(() => { void refresh(); }, []);

  async function buy(id: string) {
    setBusy(id); setMsg('');
    try {
      const result: any = await purchaseSecondaryListing(id);
      setMsg(`Purchase completed. Certificate ${result?.certificate_number || ''} transferred.`);
      await refresh();
    } catch (err: any) { setMsg(err?.message || 'Purchase failed.'); }
    finally { setBusy(null); }
  }

  return <section className="page secondaryMarketPage" style={{maxWidth: 1180, margin: '0 auto', padding: '32px 20px 72px'}}>
    <span className="eyebrow">SECONDARY MARKET</span>
    <h1 style={{fontSize:'clamp(2rem,6vw,3.5rem)', marginBottom:8}}>Loan Security Certificate Marketplace</h1>
    <p className="lead" style={{maxWidth:760}}>Review the underlying loan, payment performance, remaining principal and seller price before purchasing an existing certificate.</p>
    {msg && <div className="notice">{msg}</div>}
    <div className="secondaryMarketGrid" style={{display:'grid', gap:20, marginTop:28}}>
      {rows.map(r => {
        const p = performance[Number(r.loan_number)];
        const discount = Number(r.original_principal) > 0 ? (1 - Number(r.asking_price) / Number(r.original_principal)) * 100 : NaN;
        return <article className="panel" key={r.id} style={{border:'1px solid rgba(255,255,255,.12)', borderRadius:24, padding:22}}>
          <div style={{display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap', alignItems:'start'}}>
            <div>
              <div className="eyebrow">RESALE CERTIFICATE</div>
              <Link to={`/investment-certificate/${encodeURIComponent(r.certificate_number)}`} style={{fontSize:'1.25rem', fontWeight:800, textDecoration:'underline'}}>{r.certificate_number}</Link>
              <div style={{marginTop:8}}><Link to={`/secondary-loan/${r.loan_number}`} style={{fontWeight:700, textDecoration:'underline'}}>View underlying Loan #{r.loan_number} →</Link></div>
            </div>
            <div style={{fontSize:'1.55rem', fontWeight:900}}>{money(r.asking_price)}</div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))', gap:10, marginTop:20}}>
            <Stat label="Original investment" value={money(r.original_principal)} />
            <Stat label="Current principal" value={money(r.current_principal)} />
            <Stat label="Seller asking price" value={money(r.asking_price)} />
            <Stat label="Discount to original" value={pct(discount)} />
            <Stat label="Expected remaining value*" value={p ? money(p.expectedRemaining) : 'Loading…'} />
          </div>

          <div style={{marginTop:20, paddingTop:18, borderTop:'1px solid rgba(255,255,255,.1)'}}>
            <h3 style={{margin:'0 0 12px'}}>Loan performance</h3>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10}}>
              <Stat label="Payments made" value={p ? String(p.paid) : '—'} />
              <Stat label="Paid on time" value={p ? String(p.onTime) : '—'} />
              <Stat label="Late / missed" value={p ? String(p.late + p.missed) : '—'} />
              <Stat label="Next payment" value={p?.nextDate ? new Date(`${p.nextDate}T12:00:00`).toLocaleDateString() : 'None scheduled'} />
              <Stat label="Est. certificate share" value={p?.nextAmount != null ? money(p.nextAmount) : '—'} />
            </div>
          </div>

          <p style={{opacity:.62, fontSize:12, marginTop:14}}>*Expected remaining value is current principal plus the certificate's estimated share of scheduled remaining interest. It is not guaranteed and can change with loan performance.</p>
          <button style={{width:'100%', marginTop:12, padding:'14px 18px', borderRadius:14, fontWeight:800}} onClick={() => buy(r.id)} disabled={busy === r.id}>{busy === r.id ? 'Purchasing…' : `Buy certificate for ${money(r.asking_price)}`}</button>
        </article>;
      })}
      {!rows.length && <div className="panel">No open secondary-market listings.</div>}
    </div>
  </section>;
}

function Stat({label,value}:{label:string;value:string}) {
  return <div style={{padding:'12px 14px', borderRadius:14, background:'rgba(255,255,255,.045)'}}><div style={{fontSize:11, opacity:.62, textTransform:'uppercase', letterSpacing:'.08em'}}>{label}</div><div style={{fontWeight:800, marginTop:5}}>{value}</div></div>;
}
