"use client";

import React, { useState, useEffect } from 'react';
import { Lora, DM_Sans } from 'next/font/google';
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const lora = Lora({ 
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora'
});

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans'
});

const CARDS = [
  { id:'c1', text:'Take her to the nearest health facility within 72 hours for medical care and documentation', answer:'helpful', why:'The 72-hour window is critical for emergency contraception and HIV prevention. This cannot wait.' },
  { id:'c2', text:'Tell her to forgive the perpetrators — holding anger will only hurt her more', answer:'harmful', why:'Forgiveness is a personal journey that belongs to Amina. Telling a survivor to forgive immediately dismisses her trauma and places the burden back on her.' },
  { id:'c3', text:'Sit with her privately, listen without judgment, and let her speak in her own time', answer:'helpful', why:'Feeling believed and safe is the first thing a survivor needs. Listening without judgment is the foundation of all support.' },
  { id:'c4', text:'Ask her what she was wearing and why she was alone at that hour', answer:'harmful', why:'This implies she is responsible for what happened to her. It re-traumatises her and is never an appropriate question.' },
  { id:'c5', text:'Tell her about reporting options — police, health facility, GBV support line — without forcing any choice', answer:'helpful', why:'She has the right to know her options. The decision belongs to her, not to the Captain.' },
  { id:'c6', text:'Tell her husband immediately so the family can deal with it together', answer:'harmful', why:'Disclosing without her consent removes her control over her own story. Her husband\'s reaction may put her in further danger.' },
  { id:'c7', text:'Pray with her and offer spiritual comfort', answer:'depends', why:'Spiritual support can be meaningful — but only after immediate safety and medical needs are met, and only if she wants it.' },
  { id:'c8', text:'Encourage her to stay quiet to protect the family\'s honour', answer:'harmful', why:'This protects the perpetrators, not Amina. Silence is what allows GBV to continue.' },
  { id:'c9', text:'Make sure she is not left alone — arrange a trusted person to stay with her', answer:'helpful', why:'Isolation after trauma is dangerous. A trusted presence provides safety and reduces the risk of further harm.' },
  { id:'c10', text:'Involve the village elders to mediate between Amina and the perpetrators\' families', answer:'depends', why:'Elder involvement may have a role later, in some contexts — but never as a substitute for medical care or formal reporting, and never without Amina\'s full agreement.' },
  { id:'c11', text:'Keep her disclosure completely confidential unless she gives permission to share', answer:'helpful', why:'Confidentiality is not silence — it is her protection. Sharing without consent can expose her to further harm and stigma.' },
  { id:'c12', text:'Tell her to move on — dwelling on it will only make things worse', answer:'harmful', why:'This dismisses her trauma and denies her the support she needs. Survivors need time and consistent care, not pressure to recover quickly.' },
];

type Bucket = 'helpful' | 'harmful' | 'depends';

export default function ClimateCarePage() {
  const [currentScreen, setCurrentScreen] = useState<'story' | 'sort' | 'results' | 'order'>('story');
  const [dotIndex, setDotIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, Bucket>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentScreen]);

  const goTo = (screen: 'story' | 'sort' | 'results' | 'order', index: number) => {
    setCurrentScreen(screen);
    setDotIndex(index);
  };

  const selectCard = (id: string) => {
    setSelectedCardId(id);
  };

  const assign = (bucket: Bucket) => {
    if (!selectedCardId) return;
    const newAnswers = { ...userAnswers, [selectedCardId]: bucket };
    setUserAnswers(newAnswers);
    
    const remaining = CARDS.filter(c => !newAnswers[c.id]);
    if (remaining.length > 0) {
      setSelectedCardId(remaining[0].id);
    } else {
      setSelectedCardId(null);
    }
  };

  const resetSort = () => {
    setUserAnswers({});
    setSelectedCardId(null);
  };

  const restart = () => {
    setUserAnswers({});
    setSelectedCardId(null);
    goTo('story', 0);
  };

  const showResults = () => {
    goTo('results', 2);
  };

  const shareWhatsApp = () => {
    const url = window.location.href;
    const text = encodeURIComponent("Community Captains Training — Module 4 Activity: Amina's Story.\n\nA group exercise on GBV response. Open this link and work through it together:\n" + url);
    window.open('https://wa.me/?text=' + text, '_blank');
  };

  const doneCount = Object.keys(userAnswers).length;
  const progressPct = Math.round((doneCount / CARDS.length) * 100);
  const selectedCard = CARDS.find(c => c.id === selectedCardId);

  let correctCount = 0;
  if (currentScreen === 'results') {
    CARDS.forEach(c => {
      if (userAnswers[c.id] === c.answer) correctCount++;
    });
  }

  const getScoreMsg = (score: number) => {
    if (score >= 12) return "Outstanding. Your group understands GBV response deeply.";
    if (score >= 10) return "Very strong. Review the two you missed together.";
    if (score >= 8) return "Good foundation. The nuances will come with practice.";
    return "This is a learning moment — go through each answer together.";
  };

  return (
    <div className={`${lora.variable} ${dmSans.variable} climate-care-body flex flex-col min-h-screen`}>
      <Nav />
      <main id="main-content" className="flex-1">
        <style jsx global>{`
          :root {
          --dark: #0D2B2B;
          --teal: #0E5E5E;
          --teal-mid: #147272;
          --teal-light: #E6F4F1;
          --amber: #D97706;
          --amber-light: #FEF3C7;
          --red: #991B1B;
          --red-light: #FEE2E2;
          --green: #065F46;
          --green-light: #D1FAE5;
          --sand: #F5F0E8;
          --white: #FFFFFF;
          --text: #1a2e2e;
          --muted: #4a6565;
          --border: #d0e4e4;
        }

        .climate-care-body {
          font-family: var(--font-dm-sans), sans-serif;
          background: var(--sand);
          color: var(--text);
          min-height: 100vh;
          font-size: 15px;
          margin: 0;
          padding: 0;
        }

        .activity-header {
          background: var(--dark);
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0; /* Sticky at the very top since main nav is relative */
          z-index: 40;
        }
        @media (min-width: 768px) {
          .activity-header { top: 0; }
        }
        .header-left { display: flex; flex-direction: column; }
        .header-tag {
          font-size: 10px; font-weight: 500; color: var(--amber);
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: 2px;
        }
        .header-title { font-family: var(--font-lora), serif; font-size: 17px; color: white; }
        .progress-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .progress-label { font-size: 10px; color: #99BBBB; }
        .progress-dots { display: flex; gap: 4px; }
        .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.2); transition: background .3s;
        }
        .dot.done { background: var(--amber); }
        .dot.active { background: white; }

        .screen { animation: fadeIn .3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .story-wrap { padding: 1.25rem; }
        .story-card {
          background: var(--dark);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          position: relative;
          overflow: hidden;
        }
        .story-card::before {
          content: '';
          position: absolute; top: -40px; right: -40px;
          width: 120px; height: 120px; border-radius: 50%;
          background: var(--teal); opacity: .25;
        }
        .story-name {
          font-size: 10px; font-weight: 500; color: var(--amber);
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: .75rem;
        }
        .story-text {
          font-family: var(--font-lora), serif;
          font-size: 15px; color: #e8f4f4; line-height: 1.85;
        }
        .story-text p + p { margin-top: .85rem; }
        .story-quote {
          font-family: var(--font-lora), serif; font-style: italic;
          font-size: 14px; color: var(--amber);
          margin-top: 1rem; padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,.1);
        }

        .context-box {
          background: white; border-radius: 12px; padding: 1rem 1.25rem;
          border-left: 4px solid var(--teal); margin-bottom: 1rem;
        }
        .context-box h3 { font-size: 13px; font-weight: 500; color: var(--teal); margin-bottom: .4rem; }
        .context-box p { font-size: 13px; color: var(--muted); line-height: 1.6; }

        .btn-primary {
          width: 100%; background: var(--teal); color: white;
          border: none; border-radius: 12px; padding: 1rem;
          font-family: var(--font-dm-sans), sans-serif; font-size: 15px; font-weight: 500;
          cursor: pointer; transition: background .15s; letter-spacing: .01em;
        }
        .btn-primary:active { background: var(--dark); }

        .sort-wrap { padding: 1rem 1.25rem 2rem; }
        .sort-intro {
          font-size: 13px; color: var(--muted); line-height: 1.6;
          margin-bottom: 1rem; text-align: center;
        }

        .card-pool { margin-bottom: 1.25rem; }
        .sort-card {
          background: white;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: .85rem 1rem;
          margin-bottom: .5rem;
          cursor: pointer;
          transition: transform .1s, border-color .2s, background .2s;
          position: relative;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        .sort-card:active { transform: scale(.98); }
        .sort-card p { font-size: 13px; color: var(--text); line-height: 1.55; }
        .sort-card .card-num {
          position: absolute; top: 8px; right: 10px;
          font-size: 10px; color: var(--muted); font-weight: 500;
        }
        .sort-card.selected-helpful { border-color: var(--teal); background: var(--teal-light); }
        .sort-card.selected-helpful p { color: var(--teal); }
        .sort-card.selected-harmful { border-color: var(--red); background: var(--red-light); }
        .sort-card.selected-harmful p { color: var(--red); }
        .sort-card.selected-depends { border-color: var(--amber); background: var(--amber-light); }
        .sort-card.selected-depends p { color: #92400e; }

        .bucket-row {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 6px; margin-bottom: 1.25rem;
          position: sticky; top: 62px; z-index: 50;
          padding: 8px 0;
          background: var(--sand);
        }
        .bucket-btn {
          border: 1.5px solid var(--border); border-radius: 10px;
          padding: 8px 4px; background: white; cursor: pointer;
          font-family: var(--font-dm-sans), sans-serif; font-size: 11px;
          font-weight: 500; color: var(--muted); text-align: center;
          transition: all .15s; line-height: 1.3;
          -webkit-tap-highlight-color: transparent;
        }
        .bucket-btn.active-helpful { background: var(--teal-light); border-color: var(--teal); color: var(--teal); }
        .bucket-btn.active-harmful { background: var(--red-light); border-color: var(--red); color: var(--red); }
        .bucket-btn.active-depends { background: var(--amber-light); border-color: var(--amber); color: #92400e; }

        .selected-card-text {
          background: var(--dark); border-radius: 10px; padding: .75rem 1rem;
          margin-bottom: .85rem; min-height: 54px; display: flex; align-items: center;
        }
        .selected-card-text p {
          font-family: var(--font-lora), serif; font-size: 13px; color: #e8f4f4;
          line-height: 1.55; font-style: italic;
        }
        .selected-card-text .placeholder { font-size: 13px; color: #558888; }

        .progress-track {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 1rem;
        }
        .progress-track span { font-size: 12px; color: var(--muted); }
        .mini-bar { flex: 1; height: 4px; background: var(--border); border-radius: 4px; margin: 0 10px; overflow: hidden; }
        .mini-bar-fill { height: 100%; background: var(--teal); border-radius: 4px; transition: width .3s; }

        .btn-check {
          width: 100%; background: var(--amber); color: white;
          border: none; border-radius: 12px; padding: 1rem;
          font-family: var(--font-dm-sans), sans-serif; font-size: 15px; font-weight: 500;
          cursor: pointer; margin-bottom: .5rem; opacity: .4;
          transition: opacity .3s, background .15s;
          -webkit-tap-highlight-color: transparent;
        }
        .btn-check.ready { opacity: 1; }
        .btn-check:active { background: var(--dark); }
        .btn-reset {
          width: 100%; background: transparent; color: var(--muted);
          border: 1.5px solid var(--border); border-radius: 12px; padding: .75rem;
          font-family: var(--font-dm-sans), sans-serif; font-size: 14px; cursor: pointer;
        }

        .results-wrap { padding: 1.25rem 1.25rem 2rem; }
        .score-banner {
          background: var(--dark); border-radius: 16px; padding: 1.5rem;
          text-align: center; margin-bottom: 1.25rem;
        }
        .score-number { font-family: var(--font-lora), serif; font-size: 52px; color: white; line-height: 1; }
        .score-label { font-size: 13px; color: #99BBBB; margin-top: .3rem; }
        .score-msg { font-size: 14px; color: var(--amber); margin-top: .75rem; font-style: italic; font-family: var(--font-lora), serif; }

        .result-section { margin-bottom: 1rem; }
        .result-section-head {
          font-size: 11px; font-weight: 500; letter-spacing: .08em;
          text-transform: uppercase; padding: .5rem 0; color: var(--muted);
          border-bottom: 1px solid var(--border); margin-bottom: .6rem;
        }
        .result-item {
          display: flex; gap: 10px; padding: .6rem 0;
          border-bottom: 1px solid var(--border); align-items: flex-start;
        }
        .result-item:last-child { border-bottom: none; }
        .result-icon {
          width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; margin-top: 1px;
        }
        .icon-correct { background: var(--green-light); color: var(--green); }
        .icon-wrong { background: var(--red-light); color: var(--red); }
        .result-item-text p { font-size: 13px; color: var(--text); line-height: 1.45; }
        .result-item-text .why { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.4; }

        .insight-box {
          border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: .75rem;
        }
        .insight-box h3 { font-size: 13px; font-weight: 500; margin-bottom: .4rem; }
        .insight-box p { font-size: 13px; line-height: 1.6; }
        .insight-helpful { background: var(--green-light); border-left: 4px solid var(--green); }
        .insight-helpful h3, .insight-helpful p { color: var(--green); }
        .insight-harmful { background: var(--red-light); border-left: 4px solid var(--red); }
        .insight-harmful h3, .insight-harmful p { color: var(--red); }
        .insight-depends { background: var(--amber-light); border-left: 4px solid var(--amber); }
        .insight-depends h3 { color: #92400e; }
        .insight-depends p { color: #78350f; }

        .order-wrap { padding: 1.25rem 1.25rem 2rem; }
        .order-intro {
          font-size: 13px; color: var(--muted); line-height: 1.6; margin-bottom: 1.25rem;
        }
        .step-item {
          display: flex; gap: 12px; margin-bottom: .75rem; align-items: flex-start;
        }
        .step-circle {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          background: var(--dark); color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 500;
        }
        .step-body { flex: 1; background: white; border-radius: 10px; padding: .85rem 1rem; }
        .step-body h3 { font-size: 14px; font-weight: 500; color: var(--text); margin-bottom: .3rem; }
        .step-body p { font-size: 13px; color: var(--muted); line-height: 1.55; }
        .step-urgent { background: #FFF7ED; }
        .step-urgent h3 { color: #C2410C; }
        .step-body .step-tag {
          display: inline-block; font-size: 10px; font-weight: 500;
          padding: 2px 8px; border-radius: 4px; margin-bottom: .4rem;
          text-transform: uppercase; letter-spacing: .06em;
        }
        .tag-urgent { background: #FEE2E2; color: var(--red); }
        .tag-always { background: var(--teal-light); color: var(--teal); }
        .tag-ongoing { background: var(--amber-light); color: #92400e; }

        .closing-card {
          background: var(--dark); border-radius: 14px;
          padding: 1.25rem 1.5rem; margin-top: 1rem;
        }
        .closing-card p {
          font-family: var(--font-lora), serif; font-size: 14px;
          color: #e8f4f4; line-height: 1.8; font-style: italic;
        }

        .btn-share {
          width: 100%; background: #25D366; color: white;
          border: none; border-radius: 12px; padding: 1rem;
          font-family: var(--font-dm-sans), sans-serif; font-size: 15px; font-weight: 500;
          cursor: pointer; margin-top: 1rem; display: flex;
          align-items: center; justify-content: center; gap: 8px;
        }
        .btn-restart {
          width: 100%; background: transparent; color: var(--muted);
          border: 1.5px solid var(--border); border-radius: 12px; padding: .85rem;
          font-family: var(--font-dm-sans), sans-serif; font-size: 14px;
          cursor: pointer; margin-top: .5rem;
        }
        .whatsapp-icon { width: 18px; height: 18px; fill: white; }
      `}</style>

      <div className="activity-header">
        <div className="header-left">
          <span className="header-tag">Module 4 Activity</span>
          <span className="header-title">Amina's Story</span>
        </div>
        <div className="progress-wrap">
          <span className="progress-label">Your progress</span>
          <div className="progress-dots">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`dot ${i < dotIndex ? 'done' : ''} ${i === dotIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {currentScreen === 'story' && (
        <div className="screen">
          <div className="story-wrap">
            <div className="story-card">
              <div className="story-name">Amina's story — Kitui County</div>
              <div className="story-text">
                <p>The borehole in Amina's village has been dry for four months. Every morning at 5am, she walks 7km alone to a seasonal riverbed to collect water for her five children and her elderly mother-in-law.</p>
                <p>Her husband lost his herd to the drought and stopped leaving the house months ago. The water collection — like all the care work — falls entirely on Amina.</p>
                <p>One morning, Amina does not come back. A neighbour finds her two hours later on the path, shaking. She was attacked by two men near the thicket by the dry riverbed.</p>
                <p>She begs the neighbour not to tell anyone. She is afraid of what her husband will say. She is afraid no one will believe her. And she knows that if she stops fetching water, her children will go without.</p>
              </div>
              <div className="story-quote">"I just want to forget it happened and go home."</div>
            </div>

            <div className="context-box">
              <h3>Before you begin — discuss this with your group</h3>
              <p>Why did this happen to Amina? What role did the drought play? What does her story have to do with the care economy?</p>
            </div>

            <button className="btn-primary" onClick={() => goTo('sort', 1)}>
              We've discussed — start the activity
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'sort' && (
        <div className="screen">
          <div className="sort-wrap">
            <p className="sort-intro">Amina needs help. Below are 12 possible responses. Tap a card, then choose which column it belongs in.</p>

            <div className="selected-card-text">
              {selectedCard ? (
                <p>{selectedCard.text}</p>
              ) : (
                <span className="placeholder">Tap a card below to select it...</span>
              )}
            </div>

            <div className="bucket-row">
              <button 
                className={`bucket-btn ${selectedCardId && userAnswers[selectedCardId] === 'helpful' ? 'active-helpful' : ''}`} 
                onClick={() => assign('helpful')}
              >
                Always<br/>do this
              </button>
              <button 
                className={`bucket-btn ${selectedCardId && userAnswers[selectedCardId] === 'harmful' ? 'active-harmful' : ''}`} 
                onClick={() => assign('harmful')}
              >
                Never<br/>do this
              </button>
              <button 
                className={`bucket-btn ${selectedCardId && userAnswers[selectedCardId] === 'depends' ? 'active-depends' : ''}`} 
                onClick={() => assign('depends')}
              >
                It<br/>depends
              </button>
            </div>

            <div className="progress-track">
              <span>{doneCount} of {CARDS.length}</span>
              <div className="mini-bar">
                <div className="mini-bar-fill" style={{ width: `${progressPct}%` }}></div>
              </div>
              <span>{progressPct}%</span>
            </div>

            <div className="card-pool">
              {CARDS.map((c, i) => (
                <div 
                  key={c.id}
                  className={`sort-card ${userAnswers[c.id] ? `selected-${userAnswers[c.id]}` : ''}`}
                  style={{ outline: selectedCardId === c.id ? '2px solid #0E5E5E' : 'none' }}
                  onClick={() => selectCard(c.id)}
                >
                  <span className="card-num">{i+1}</span>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>

            <button 
              className={`btn-check ${doneCount === CARDS.length ? 'ready' : ''}`} 
              disabled={doneCount !== CARDS.length}
              onClick={showResults}
            >
              Check our answers
            </button>
            <button className="btn-reset" onClick={resetSort}>Start over</button>
          </div>
        </div>
      )}

      {currentScreen === 'results' && (
        <div className="screen">
          <div className="results-wrap">
            <div className="score-banner">
              <div className="score-number">{correctCount}/12</div>
              <div className="score-label">cards sorted correctly</div>
              <div className="score-msg">{getScoreMsg(correctCount)}</div>
            </div>

            <div className="insight-box insight-helpful">
              <h3>Always do this</h3>
              <p>Medical care within 72 hours, listening without judgment, confidentiality, staying with her, and giving options without forcing a choice — these protect Amina's safety, health, and dignity at the same time.</p>
            </div>
            <div className="insight-box insight-harmful">
              <h3>Never do this</h3>
              <p>Questioning her behaviour, telling her husband without consent, asking her to stay quiet, or telling her to move on — these re-traumatise her and deepen the stigma that stops survivors coming forward.</p>
            </div>
            <div className="insight-box insight-depends">
              <h3>It depends</h3>
              <p>Prayer and elder mediation are not wrong — but they are never step one, two, or three. Safety and medical care come first. Everything else comes after, and only with Amina's consent.</p>
            </div>

            <div className="result-section">
              <div className="result-section-head">Card by card</div>
              {CARDS.map(c => {
                const isCorrect = userAnswers[c.id] === c.answer;
                const bucketLabel = { helpful: 'Always do this', harmful: 'Never do this', depends: 'It depends' };
                return (
                  <div key={c.id} className="result-item">
                    <div className={`result-icon ${isCorrect ? 'icon-correct' : 'icon-wrong'}`}>
                      {isCorrect ? '✓' : '✗'}
                    </div>
                    <div className="result-item-text">
                      <p>{c.text}</p>
                      <div className="why">
                        {!isCorrect && <strong>Correct: {bucketLabel[c.answer]}. </strong>}
                        {c.why}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="btn-primary" onClick={() => goTo('order', 3)} style={{ marginBottom:'.5rem' }}>
              See the correct order of response
            </button>
            <button className="btn-restart" onClick={restart}>Try the activity again</button>
          </div>
        </div>
      )}

      {currentScreen === 'order' && (
        <div className="screen">
          <div className="order-wrap">
            <p className="order-intro">After a GBV incident, this is the correct sequence. Share this with your group — and remember it.</p>

            <div className="step-item">
              <div className="step-circle">1</div>
              <div className="step-body step-urgent">
                <span className="step-tag tag-urgent">Do this immediately</span>
                <h3>Make her safe — stay with her</h3>
                <p>Remove her from the location. Do not leave until a trusted person takes over. She must not be alone.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-circle">2</div>
              <div className="step-body">
                <span className="step-tag tag-always">Always</span>
                <h3>Listen — do not interrogate</h3>
                <p>Do not ask why she was alone, what she was wearing, or anything that implies fault. Just listen.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-circle">3</div>
              <div className="step-body step-urgent">
                <span className="step-tag tag-urgent">Within 72 hours — no exceptions</span>
                <h3>Medical care</h3>
                <p>Emergency contraception, HIV prevention treatment, and injury documentation. This window closes. Do not wait.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-circle">4</div>
              <div className="step-body">
                <span className="step-tag tag-always">Always</span>
                <h3>Give options — let her choose</h3>
                <p>Tell her about the police, health facility, GBV case workers, and legal aid. She decides. Not you.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-circle">5</div>
              <div className="step-body">
                <span className="step-tag tag-always">Always</span>
                <h3>Keep everything confidential</h3>
                <p>Do not tell her husband, the elders, or anyone else without her permission. Confidentiality protects her.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-circle">6</div>
              <div className="step-body">
                <span className="step-tag tag-ongoing">Ongoing</span>
                <h3>Psychological support</h3>
                <p>Check in over time. Connect her to a counsellor. Combat the stigma in your community publicly.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-circle">7</div>
              <div className="step-body">
                <span className="step-tag tag-ongoing">Advocacy</span>
                <h3>Fix the root cause</h3>
                <p>Amina was attacked because the borehole is dry and she walks alone at 5am. Report it as a safety emergency. This prevents the next attack.</p>
              </div>
            </div>

            <div className="closing-card">
              <p>"Forgiveness, prayer, and community harmony all have a place — but none of them are step one, two, or three. Amina's life and health come first. Everything else comes after."</p>
            </div>

            <button className="btn-share" onClick={shareWhatsApp}>
              <svg className="whatsapp-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share this activity
            </button>
            <button className="btn-restart" onClick={restart}>Start over</button>
          </div>
        </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
