import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, Shield, Activity, Sparkles, ArrowRight, Users, Stethoscope,
  FlaskConical, UserCog, ScanLine, MessageSquare, ChevronRight,
  Zap, TrendingUp, Lock, HeartPulse, Microscope, BarChart3,
  Star, Play, CheckCircle2, Clock, Globe2, Award,
  Newspaper, Heart, Calendar, BookOpen, ExternalLink, AlertTriangle, Ribbon
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   SEP PLATFORM — HOME / LANDING PAGE
   Premium medical AI landing with animations & glassmorphism
   ═══════════════════════════════════════════════════════════════ */

// ── Animated counter hook ──────────────────────────────────────
function useCountUp(target, duration = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const animate = (now) => {
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return [count, ref]
}

// ── Particle component ────────────────────────────────────────
function FloatingParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 5,
    duration: Math.random() * 3 + 4,
    opacity: Math.random() * 0.3 + 0.1,
  }))

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: `rgba(79, 70, 229, ${p.opacity * 0.5})`,
            animation: `floatParticle ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Animated DNA Helix ────────────────────────────────────────
function DNAHelix() {
  const dots = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div style={{
      position: 'absolute', right: '-60px', top: '50%', transform: 'translateY(-50%)',
      opacity: 0.08, pointerEvents: 'none',
    }}>
      {dots.map(i => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '40px',
          animation: `dnaRotate 3s ease-in-out infinite`,
          animationDelay: `${i * 0.15}s`,
          marginBottom: '8px',
        }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: '#4f46e5',
          }} />
          <div style={{
            width: '50px', height: '2px',
            background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
          }} />
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: '#7c3aed',
          }} />
        </div>
      ))}
    </div>
  )
}


export default function Home() {
  const navigate = useNavigate()
  const [scrollY, setScrollY] = useState(0)
  const [activeFeature, setActiveFeature] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [activeNews, setActiveNews] = useState(0)

  useEffect(() => {
    setIsVisible(true)
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-cycle features
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 4)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  const [stat1, ref1] = useCountUp(99, 2000)
  const [stat2, ref2] = useCountUp(15000, 2500)
  const [stat3, ref3] = useCountUp(24, 1500)
  const [stat4, ref4] = useCountUp(4, 1200)

  const features = [
    {
      icon: ScanLine, title: 'Classification IRM', color: '#4f46e5', bg: '#eef2ff',
      desc: 'Détection automatique de la SEP par IA avec une précision de 99.35% grâce à ResNet-50',
      tag: 'ResNet-50',
    },
    {
      icon: Brain, title: 'Segmentation de Lésions', color: '#0891b2', bg: '#e0f7fa',
      desc: 'Segmentation 3D des lésions cérébrales avec U-Net, Dice score de 0.82',
      tag: 'U-Net 3D',
    },
    {
      icon: TrendingUp, title: 'Prédiction EDSS', color: '#059669', bg: '#ecfdf5',
      desc: 'Modèles prédictifs pour anticiper l\'évolution du handicap et adapter le traitement',
      tag: 'XGBoost',
    },
    {
      icon: MessageSquare, title: 'Assistant IA Médical', color: '#7c3aed', bg: '#f5f3ff',
      desc: 'Chat intelligent basé sur Llama 3.3 pour aide au diagnostic et analyse clinique',
      tag: 'Llama 3.3',
    },
  ]

  const roles = [
    {
      icon: Stethoscope, title: 'Médecin', color: '#4f46e5', bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
      items: ['Dossiers patients', 'Suivi EDSS', 'Classification IRM', 'Chat IA'],
    },
    {
      icon: Microscope, title: 'Radiologue', color: '#0891b2', bg: 'linear-gradient(135deg, #e0f7fa, #cffafe)',
      items: ['Analyse IRM', 'Segmentation lésions', 'Rapports détaillés', 'Visualisation 3D'],
    },
    {
      icon: FlaskConical, title: 'Laboratoire', color: '#059669', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
      items: ['Analyses biologiques', 'Résultats tests', 'Suivi biomarqueurs', 'Historique'],
    },
    {
      icon: UserCog, title: 'Administrateur', color: '#dc2626', bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
      items: ['Gestion utilisateurs', 'Validations comptes', 'Statistiques', 'Configuration'],
    },
    {
      icon: HeartPulse, title: 'Patient', color: '#7c3aed', bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
      items: ['Mon dossier', 'Mon évolution', 'Mes rapports', 'Actualités SEP'],
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: 'hidden',
    }}>

      {/* ================================================================
          NAVBAR
          ================================================================ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 48px',
        height: '72px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrollY > 50 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderBottom: scrollY > 50 ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        transition: 'all 0.4s ease',
      }}>
        {/* Logo with SEP ribbon + NeuroNova */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img 
            src="/logo-sep.png" 
            alt="Neuro Predict MS" 
            style={{ width: '48px', height: '48px', objectFit: 'contain' }} 
          />
          <div>
            <span style={{
              fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#1a1d26',
            }}>
              Neuro <span style={{ color: '#4f46e5' }}>Predict MS</span>
            </span>
            <div style={{
              fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', marginTop: '-2px',
              color: '#9ca3b0',
            }}>
              IA MÉDICALE AVANCÉE
            </div>
          </div>

        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {['Fonctionnalités', 'Rôles', 'Statistiques'].map(item => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              style={{
                fontSize: '14px', fontWeight: 500,
                color: '#5a6070',
                textDecoration: 'none', transition: 'color 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.target.style.color = '#4f46e5'}
              onMouseLeave={e => e.target.style.color = '#5a6070'}
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 24px', borderRadius: '10px',
              border: '1px solid #e2e5eb',
              background: '#fff',
              fontSize: '14px', fontWeight: 600,
              color: '#1a1d26',
              cursor: 'pointer', transition: 'all 0.3s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.target.style.borderColor = '#818cf8'
              e.target.style.color = '#4f46e5'
            }}
            onMouseLeave={e => {
              e.target.style.borderColor = '#e2e5eb'
              e.target.style.color = '#1a1d26'
            }}
          >
            Se connecter
          </button>
          <button
            onClick={() => navigate('/inscription')}
            className="btn-primary"
            style={{ padding: '10px 24px', fontSize: '14px' }}
          >
            Créer un compte <ArrowRight size={15} />
          </button>
        </div>
      </nav>


      {/* ================================================================
          HERO SECTION
          ================================================================ */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '100px 48px 60px',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #f0f4ff 0%, #e8edff 30%, #eef2ff 60%, #f5f7ff 100%)',
      }}>
        {/* Animated background particles */}
        <FloatingParticles />

        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(79,70,229,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,70,229,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
        }} />

        {/* Gradient blobs */}
        <div style={{
          position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)',
          top: '10%', left: '15%', filter: 'blur(80px)',
          transform: `translateY(${scrollY * 0.05}px)`,
        }} />
        <div style={{
          position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
          bottom: '5%', right: '10%', filter: 'blur(80px)',
        }} />

        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '80px',
          maxWidth: '1200px', width: '100%',
        }}>

          {/* ── LEFT: Text content ──────────────────────── */}
          <div style={{
            flex: 1,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateX(0)' : 'translateX(-40px)',
            transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            {/* Badge label */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '50px',
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              marginBottom: '28px',
              animation: 'heroFadeIn 0.8s ease-out 0.2s backwards',
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#22c55e',
                animation: 'pulse-soft 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', letterSpacing: '0.03em' }}>
                IA MÉDICALE AVANCÉE
              </span>
            </div>

            {/* Headline — short and punchy */}
            <h1 style={{
              fontSize: 'clamp(38px, 4.5vw, 60px)',
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              color: '#1a1d26',
              margin: '0 0 24px',
              animation: 'heroFadeIn 0.8s ease-out 0.4s backwards',
            }}>
              Chaque cerveau
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 40%, #0891b2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                mérite d'être protégé.
              </span>
            </h1>

            {/* Short description */}
            <p style={{
              fontSize: '17px', lineHeight: 1.7, color: '#5a6070',
              maxWidth: '480px', margin: '0 0 16px',
              animation: 'heroFadeIn 0.8s ease-out 0.6s backwards',
            }}>
              Détection, suivi et prédiction de la{' '}
              <strong style={{ color: '#1a1d26' }}>Sclérose En Plaques</strong>{' '}
              grâce à l'intelligence artificielle.
            </p>

            {/* Emotional message for patients */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 20px', borderRadius: '14px',
              background: 'rgba(79,70,229,0.06)',
              border: '1px solid rgba(79,70,229,0.12)',
              marginBottom: '36px',
              maxWidth: '480px',
              animation: 'heroFadeIn 0.8s ease-out 0.8s backwards',
            }}>
              <HeartPulse size={20} color="#f472b6" style={{ flexShrink: 0, animation: 'heartbeat 1.5s ease-in-out infinite' }} />
              <p style={{ fontSize: '13px', color: '#5a6070', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                « À tous ceux qui se battent contre la SEP — vous n'êtes pas seuls.
                La technologie est à vos côtés. »
              </p>
            </div>

            {/* CTA Buttons */}
            <div style={{
              display: 'flex', gap: '14px', flexWrap: 'wrap',
              animation: 'heroFadeIn 0.8s ease-out 1s backwards',
            }}>
              <button
                onClick={() => navigate('/inscription')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  padding: '15px 32px', fontSize: '15px', borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 24px rgba(79,70,229,0.4)',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(79,70,229,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(79,70,229,0.4)' }}
              >
                Créer un compte <ArrowRight size={17} />
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  padding: '15px 32px', fontSize: '15px', borderRadius: '12px',
                  border: '1px solid #dfe2e8',
                  background: '#fff',
                  color: '#1a1d26', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.background = '#f8f9fc' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dfe2e8'; e.currentTarget.style.background = '#fff' }}
              >
                <Lock size={15} />
                Se connecter
              </button>
            </div>

            {/* Tiny tech badges */}
            <div style={{
              display: 'flex', gap: '8px', marginTop: '32px', flexWrap: 'wrap',
              animation: 'heroFadeIn 0.8s ease-out 1.2s backwards',
            }}>
              {[
                { t: 'ResNet-50', c: '#818cf8' },
                { t: 'U-Net 3D', c: '#38bdf8' },
                { t: 'Llama 3.3', c: '#c084fc' },
                { t: 'XGBoost', c: '#34d399' },
              ].map(b => (
                <span key={b.t} style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                  color: '#4f46e5', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)',
                  letterSpacing: '0.02em',
                }}>
                  {b.t}
                </span>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Animated Brain Logo ──────────────── */}
          <div style={{
            width: '480px', height: '480px',
            position: 'relative', flexShrink: 0,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
          }}>

            {/* Outermost pulse ring */}
            <div style={{
              position: 'absolute', inset: '-20px',
              borderRadius: '50%',
              border: '1px solid rgba(99,102,241,0.06)',
              animation: 'pulseRing 4s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '-20px',
              borderRadius: '50%',
              border: '1px solid rgba(99,102,241,0.06)',
              animation: 'pulseRing 4s ease-out infinite 2s',
            }} />

            {/* Outer orbit ring */}
            <div style={{
              position: 'absolute', inset: '20px',
              borderRadius: '50%',
              border: '1.5px dashed rgba(99,102,241,0.1)',
              animation: 'spin 40s linear infinite reverse',
            }} />

            {/* Middle orbit ring */}
            <div style={{
              position: 'absolute', inset: '70px',
              borderRadius: '50%',
              border: '1px solid rgba(124,58,237,0.08)',
              animation: 'spin 30s linear infinite',
            }} />

            {/* Inner orbit ring */}
            <div style={{
              position: 'absolute', inset: '130px',
              borderRadius: '50%',
              border: '1px dashed rgba(56,189,248,0.1)',
              animation: 'spin 20s linear infinite reverse',
            }} />

            {/* Orbiting icons — outer ring */}
            {[
              { icon: Stethoscope, angle: 0, delay: '0s', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
              { icon: Microscope, angle: 72, delay: '-3s', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
              { icon: FlaskConical, angle: 144, delay: '-6s', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
              { icon: Shield, angle: 216, delay: '-9s', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
              { icon: Activity, angle: 288, delay: '-12s', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
            ].map(({ icon: Icon, angle, delay, color, bg }, i) => (
              <div key={i} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: '0', height: '0',
                animation: `orbitHero 18s linear infinite`,
                animationDelay: delay,
                transform: `rotate(${angle}deg)`,
              }}>
                <div style={{
                  position: 'absolute',
                  transform: 'translate(-50%, -50%)',
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: bg,
                  border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  boxShadow: `0 0 20px ${color}15`,
                }}>
                  <Icon size={19} color={color} />
                </div>
              </div>
            ))}

            {/* Orbiting icons — inner ring (smaller) */}
            {[
              { icon: ScanLine, delay: '0s', color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
              { icon: MessageSquare, delay: '-4s', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
              { icon: TrendingUp, delay: '-8s', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
            ].map(({ icon: Icon, delay, color, bg }, i) => (
              <div key={`inner-${i}`} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: '0', height: '0',
                animation: `orbitHeroInner 12s linear infinite reverse`,
                animationDelay: delay,
              }}>
                <div style={{
                  position: 'absolute',
                  transform: 'translate(-50%, -50%)',
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: bg,
                  border: `1px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}>
                  <Icon size={16} color={color} />
                </div>
              </div>
            ))}

            {/* CENTER — Main Brain Logo */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '120px', height: '120px', borderRadius: '30px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 60px rgba(79,70,229,0.4), 0 0 120px rgba(124,58,237,0.15)',
              animation: 'logoFloat 4s ease-in-out infinite, logoGlow 3s ease-in-out infinite alternate',
              zIndex: 5,
            }}>
              <Brain size={52} color="#fff" strokeWidth={1.5} />
            </div>

            {/* Glow ring around center */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '150px', height: '150px', borderRadius: '50%',
              border: '2px solid rgba(99,102,241,0.2)',
              animation: 'pulseGlow 2s ease-in-out infinite alternate',
              zIndex: 4,
            }} />

            {/* Secondary glow */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '180px', height: '180px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
              animation: 'pulseGlow 3s ease-in-out infinite alternate-reverse',
              zIndex: 3,
            }} />
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          opacity: scrollY > 100 ? 0 : 0.6, transition: 'opacity 0.3s',
        }}>
          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Découvrir</span>
          <div style={{
            width: '22px', height: '36px', borderRadius: '11px',
            border: '1.5px solid rgba(79,70,229,0.25)', display: 'flex', justifyContent: 'center', paddingTop: '8px',
          }}>
            <div style={{
              width: '3px', height: '7px', borderRadius: '2px', background: 'rgba(79,70,229,0.4)',
              animation: 'scrollBounce 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>
      </section>


      {/* ================================================================
          FEATURES SECTION
          ================================================================ */}
      <section id="fonctionnalités" style={{
        padding: '100px 48px',
        position: 'relative',
        background: '#fff',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '50px',
              background: '#eef2ff', color: '#4f46e5',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em',
              marginBottom: '20px', textTransform: 'uppercase',
            }}>
              <Zap size={14} />
              Fonctionnalités
            </div>
            <h2 style={{
              fontSize: '42px', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#1a1d26', margin: '0 0 16px',
            }}>
              Des outils d'IA{' '}
              <span className="gradient-text">puissants</span>
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '550px', margin: '0 auto', lineHeight: 1.7 }}>
              Notre plateforme intègre les dernières avancées en intelligence artificielle
              pour un diagnostic et un suivi médical de précision.
            </p>
          </div>

          {/* Feature cards interactive */}
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '32px', alignItems: 'start' }}>
            {/* Feature tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {features.map((feat, i) => {
                const Icon = feat.icon
                const isActive = activeFeature === i
                return (
                  <div
                    key={i}
                    onClick={() => setActiveFeature(i)}
                    style={{
                      padding: '20px 24px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: isActive ? '#fff' : 'transparent',
                      border: isActive ? '1px solid rgba(79,70,229,0.15)' : '1px solid transparent',
                      boxShadow: isActive ? '0 4px 20px rgba(79,70,229,0.08)' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: '16px',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafbfc' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '14px',
                      background: isActive ? feat.bg : '#f5f6f8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.3s',
                    }}>
                      <Icon size={22} color={isActive ? feat.color : '#9ca3b0'} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: '15px', fontWeight: 700,
                        color: isActive ? '#1a1d26' : '#5a6070',
                        marginBottom: '4px', transition: 'color 0.3s',
                      }}>
                        {feat.title}
                      </div>
                      <div style={{
                        fontSize: '13px', color: '#9ca3b0', lineHeight: 1.5,
                        maxHeight: isActive ? '60px' : '0',
                        overflow: 'hidden', transition: 'max-height 0.4s ease',
                      }}>
                        {feat.desc}
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight size={16} color="#4f46e5" style={{ marginTop: '4px', flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Feature detail card */}
            <div
              key={activeFeature}
              style={{
                padding: '48px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #fafbff, #f0f4ff)',
                border: '1px solid rgba(79,70,229,0.08)',
                position: 'relative', overflow: 'hidden',
                minHeight: '380px',
                animation: 'fadeIn 0.4s ease-out',
              }}
            >
              {/* Background accent */}
              <div style={{
                position: 'absolute', top: '-50px', right: '-50px',
                width: '200px', height: '200px', borderRadius: '50%',
                background: `radial-gradient(circle, ${features[activeFeature].color}10, transparent)`,
                filter: 'blur(40px)',
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <span style={{
                  display: 'inline-block', padding: '6px 14px', borderRadius: '20px',
                  background: features[activeFeature].bg,
                  color: features[activeFeature].color,
                  fontSize: '12px', fontWeight: 700, marginBottom: '24px',
                  border: `1px solid ${features[activeFeature].color}20`,
                }}>
                  {features[activeFeature].tag}
                </span>

                <h3 style={{
                  fontSize: '28px', fontWeight: 800, color: '#1a1d26',
                  letterSpacing: '-0.02em', marginBottom: '16px',
                }}>
                  {features[activeFeature].title}
                </h3>

                <p style={{
                  fontSize: '15px', color: '#5a6070', lineHeight: 1.8,
                  marginBottom: '32px', maxWidth: '500px',
                }}>
                  {features[activeFeature].desc}
                </p>

                {/* Feature highlights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    'Analyse en temps réel',
                    'Résultats fiables et validés',
                    'Interface intuitive',
                    'Rapports détaillés exportables',
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={18} color={features[activeFeature].color} />
                      <span style={{ fontSize: '14px', color: '#3a3f4b', fontWeight: 500 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Animated orbiting brain visual */}
              <div style={{
                position: 'absolute', bottom: '30px', right: '40px',
                width: '160px', height: '160px', opacity: 0.15,
              }}>
                <div style={{
                  width: '100%', height: '100%',
                  border: `2px dashed ${features[activeFeature].color}`,
                  borderRadius: '50%',
                  animation: 'spin 20s linear infinite',
                }} />
                {(() => {
                  const Icon = features[activeFeature].icon
                  return (
                    <Icon
                      size={40}
                      color={features[activeFeature].color}
                      style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ================================================================
          STATISTICS SECTION
          ================================================================ */}
      <section id="statistiques" style={{
        padding: '80px 48px',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f0f4ff 50%, #f5f3ff 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(79,70,229,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,70,229,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{
              fontSize: '36px', fontWeight: 800, color: '#1a1d26',
              letterSpacing: '-0.03em', margin: '0 0 12px',
            }}>
              Des résultats qui{' '}
              <span className="gradient-text">parlent</span>
            </h2>
            <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '500px', margin: '0 auto' }}>
              Notre plateforme combine précision algorithmique et expertise médicale
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            {[
              { ref: ref1, value: `${stat1}.35%`, label: 'Précision Classification', icon: Award, color: '#4f46e5' },
              { ref: ref2, value: stat2.toLocaleString() + '+', label: 'Images Analysées', icon: ScanLine, color: '#059669' },
              { ref: ref3, value: `${stat3}/7`, label: 'Disponibilité', icon: Clock, color: '#d97706' },
              { ref: ref4, value: `${stat4} Rôles`, label: 'Espaces Dédiés', icon: Users, color: '#7c3aed' },
            ].map((s, i) => (
              <div
                key={i}
                ref={s.ref}
                style={{
                  padding: '32px 28px',
                  borderRadius: '20px',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${s.color}30`
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = `0 12px 32px ${s.color}15`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
                }}
              >
                <s.icon size={28} color={s.color} style={{ marginBottom: '16px' }} />
                <div style={{
                  fontSize: '32px', fontWeight: 800, color: '#1a1d26',
                  letterSpacing: '-0.03em', marginBottom: '8px',
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ================================================================
          ROLES SECTION
          ================================================================ */}
      <section id="rôles" style={{
        padding: '100px 48px',
        background: '#f8f9fc',
        position: 'relative',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '50px',
              background: '#ecfdf5', color: '#059669',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em',
              marginBottom: '20px', textTransform: 'uppercase',
            }}>
              <Users size={14} />
              Multi-Rôles
            </div>
            <h2 style={{
              fontSize: '42px', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#1a1d26', margin: '0 0 16px',
            }}>
              Un espace pour{' '}
              <span className="gradient-text">chaque professionnel</span>
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '550px', margin: '0 auto', lineHeight: 1.7 }}>
              Chaque rôle dispose d'un tableau de bord personnalisé avec les outils
              et fonctionnalités adaptés à ses besoins.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
          }}>
            {roles.map((role, i) => {
              const Icon = role.icon
              return (
                <div
                  key={i}
                  style={{
                    padding: '32px 24px',
                    borderRadius: '20px',
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.06)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative', overflow: 'hidden',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-6px)'
                    e.currentTarget.style.boxShadow = `0 12px 40px ${role.color}15`
                    e.currentTarget.style.borderColor = `${role.color}25`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Top gradient accent */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: role.bg,
                    opacity: 0.8,
                  }} />

                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: role.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '20px',
                  }}>
                    <Icon size={24} color={role.color} />
                  </div>

                  <h3 style={{
                    fontSize: '18px', fontWeight: 700, color: '#1a1d26',
                    marginBottom: '16px', letterSpacing: '-0.01em',
                  }}>
                    {role.title}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {role.items.map((item, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: role.color, opacity: 0.5, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '13px', color: '#5a6070' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>


      {/* ================================================================
          HOW IT WORKS SECTION
          ================================================================ */}
      <section style={{
        padding: '100px 48px',
        background: '#fff',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '50px',
              background: '#f5f3ff', color: '#7c3aed',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em',
              marginBottom: '20px', textTransform: 'uppercase',
            }}>
              <Play size={14} />
              Comment ça marche
            </div>
            <h2 style={{
              fontSize: '42px', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#1a1d26', margin: '0 0 16px',
            }}>
              Trois étapes{' '}
              <span className="gradient-text">simples</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', position: 'relative' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute', left: '28px', top: '40px', bottom: '40px', width: '2px',
              background: 'linear-gradient(180deg, #4f46e5, #7c3aed, #0891b2)',
              borderRadius: '1px',
            }} />

            {[
              {
                step: '01', title: 'Créez votre compte',
                desc: 'Inscrivez-vous en choisissant votre rôle (médecin, radiologue, laboratoire, patient). Votre compte sera validé par un administrateur.',
                icon: Users, color: '#4f46e5',
              },
              {
                step: '02', title: 'Accédez à votre espace',
                desc: 'Une fois validé, connectez-vous pour accéder à votre tableau de bord personnalisé avec les outils adaptés à votre rôle.',
                icon: Shield, color: '#7c3aed',
              },
              {
                step: '03', title: 'Utilisez l\'IA médicale',
                desc: 'Uploadez des IRM, lancez des analyses, consultez des prédictions et interagissez avec l\'assistant IA pour une prise en charge optimale.',
                icon: Brain, color: '#0891b2',
              },
            ].map((step, i) => {
              const Icon = step.icon
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '32px',
                    padding: '32px 0',
                  }}
                >
                  {/* Step number circle */}
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: '#fff',
                    border: `3px solid ${step.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, zIndex: 1,
                    boxShadow: `0 0 0 6px #fff, 0 4px 12px ${step.color}20`,
                  }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: step.color }}>
                      {step.step}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1, padding: '8px 32px 8px 0',
                    borderRadius: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <Icon size={20} color={step.color} />
                      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>
                        {step.title}
                      </h3>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, margin: 0 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>


      {/* ================================================================
          ACTUALITÉS SEP — News, Orgs & Awareness (Tunisian Touch)
          ================================================================ */}
      <section id="actualités" style={{
        padding: '100px 48px 80px',
        background: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Very subtle background accents */}
        <div style={{
          position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.03) 0%, transparent 60%)',
          top: '-10%', right: '-5%', filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,38,38,0.02) 0%, transparent 60%)',
          bottom: '5%', left: '-5%', filter: 'blur(80px)',
        }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              padding: '8px 22px', borderRadius: '50px',
              background: '#eef2ff',
              border: '1px solid rgba(79,70,229,0.12)',
              color: '#4f46e5',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em',
              marginBottom: '24px', textTransform: 'uppercase',
            }}>
              <span style={{ fontSize: '18px' }}>🇹🇳</span>
              <Heart size={14} color="#4f46e5" style={{ animation: 'heartbeat 2s ease-in-out infinite' }} />
              SEP en Tunisie & dans le monde
            </div>
            <h2 style={{
              fontSize: '44px', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#1a1d26', margin: '0 0 18px',
            }}>
              Actualités &{' '}
              <span className="gradient-text">Ressources</span>
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
              Découvrez les organisations tunisiennes et internationales qui se battent
              contre la Sclérose En Plaques, et suivez les dernières actualités.
            </p>
          </div>


          {/* ── Animated Ticker ──────────────────────────── */}
          <div style={{
            marginBottom: '56px', overflow: 'hidden',
            borderRadius: '16px',
            background: '#f8f9fc',
            border: '1px solid rgba(0,0,0,0.05)',
            padding: '16px 0',
          }}>
            <div style={{
              display: 'flex', gap: '48px',
              animation: 'tickerScroll 35s linear infinite',
              width: 'max-content',
            }}>
              {[...Array(2)].map((_, repeat) => [
                { icon: '🇹🇳', text: 'La Tunisie compte environ 6 000 patients atteints de SEP' },
                { icon: '🧬', text: '2,8 millions de personnes vivent avec la SEP dans le monde' },
                { icon: '🏥', text: 'L\'Institut Mongi Ben Hamida : centre de référence neurologique en Tunisie' },
                { icon: '💊', text: 'Nouveaux anticorps monoclonaux : réduction de 95% des poussées' },
                { icon: '🎗️', text: 'Journée mondiale de la SEP : 30 Mai — #WorldMSDay' },
                { icon: '🧠', text: '1ère cause de handicap non-traumatique chez les jeunes adultes' },
                { icon: '⚡', text: 'Diagnostic précoce = meilleur pronostic à long terme' },
                { icon: '🔬', text: 'Plus de 20 traitements de fond approuvés depuis 1993' },
              ].map((item, i) => (
                <div key={`${repeat}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '17px' }}>{item.icon}</span>
                  <span style={{ fontSize: '13px', color: '#5a6070', fontWeight: 500 }}>{item.text}</span>
                  <span style={{ color: 'rgba(79,70,229,0.15)', fontSize: '14px' }}>◆</span>
                </div>
              )))
              }
            </div>
          </div>


          {/* ── Organisations with Website Previews ─── */}
          <div style={{ marginBottom: '56px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '32px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: '#eef2ff',
                border: '1px solid rgba(79,70,229,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Globe2 size={20} color="#4f46e5" />
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
                Organisations & Ressources
              </h3>
              <div style={{
                height: '1px', flex: 1,
                background: 'linear-gradient(90deg, rgba(79,70,229,0.15), transparent)',
              }} />
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px',
            }}>
              {[
                {
                  name: 'Ministère de la Santé',
                  sub: 'Portail officiel — Santé publique',
                  desc: 'Site officiel du Ministère de la Santé tunisien : centres de soins et programmes de prévention.',
                  url: 'https://www.tunisie.gov.tn',
                  preview: 'https://s.wordpress.com/mshots/v1/https%3A%2F%2Fwww.tunisie.gov.tn?w=600&h=400',
                  color: '#dc2626', tag: '🇹🇳 Tunisie',
                },
                {
                  name: 'ATSEP — Assoc. Tunisienne SEP',
                  sub: 'Accompagnement & Soutien patients',
                  desc: 'Association dédiée à l\'accompagnement des patients SEP en Tunisie : aide sociale et plaidoyer.',
                  url: 'https://www.facebook.com/ATSEP.Tunisie/',
                  preview: 'https://s.wordpress.com/mshots/v1/https%3A%2F%2Fwww.facebook.com%2FATSEP.Tunisie%2F?w=600&h=400',
                  color: '#1d4ed8', tag: '🇹🇳 Tunisie',
                },
                {
                  name: 'Association Tunisienne de Neurologie',
                  sub: 'Neuro Tunisia — Recherche & Formation',
                  desc: 'Association des neurologues tunisiens : congrès annuels, formations et recherche sur la SEP.',
                  url: 'https://neurotunisia.tn',
                  preview: 'https://s.wordpress.com/mshots/v1/https%3A%2F%2Fneurotunisia.tn?w=600&h=400',
                  color: '#d97706', tag: '🇹🇳 Tunisie',
                },
                {
                  name: 'Institut Mongi Ben Hamida',
                  sub: 'Institut National de Neurologie — La Rabta',
                  desc: 'Centre de référence pour la neurologie en Tunisie, spécialisé dans le diagnostic de la SEP.',
                  url: 'https://fr.wikipedia.org/wiki/Institut_national_de_neurologie_de_Tunis',
                  preview: 'https://s.wordpress.com/mshots/v1/https%3A%2F%2Ffr.wikipedia.org%2Fwiki%2FInstitut_national_de_neurologie_de_Tunis?w=600&h=400',
                  color: '#059669', tag: '🇹🇳 Tunisie',
                },
                {
                  name: 'MSIF — Fédération Internationale',
                  sub: 'Multiple Sclerosis International Federation',
                  desc: 'Réseau mondial reliant les organisations SEP de 100+ pays pour la recherche et les soins.',
                  url: 'https://www.msif.org',
                  preview: 'https://s.wordpress.com/mshots/v1/https%3A%2F%2Fwww.msif.org?w=600&h=400',
                  color: '#4f46e5', tag: 'International',
                },
                {
                  name: 'National MS Society',
                  sub: 'Recherche & Programmes — USA',
                  desc: 'Organisation leader dans le financement de la recherche SEP et le soutien aux patients.',
                  url: 'https://www.nationalmssociety.org',
                  preview: 'https://s.wordpress.com/mshots/v1/https%3A%2F%2Fwww.nationalmssociety.org?w=600&h=400',
                  color: '#0284c7', tag: 'International',
                },
              ].map((org, i) => (
                <a
                  key={i}
                  href={org.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    borderRadius: '20px',
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    textDecoration: 'none',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                    e.currentTarget.style.boxShadow = `0 24px 60px ${org.color}18`
                    e.currentTarget.style.borderColor = `${org.color}25`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.05)'
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
                  }}
                >
                  {/* Website Preview Image */}
                  <div style={{
                    position: 'relative', width: '100%', height: '180px',
                    overflow: 'hidden', background: '#f3f4f6',
                  }}>
                    <img
                      src={org.preview}
                      alt={`Aperçu ${org.name}`}
                      loading="lazy"
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', objectPosition: 'top',
                        transition: 'transform 0.6s ease',
                      }}
                      onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                      onError={e => {
                        e.target.style.display = 'none'
                        e.target.parentElement.style.background = `linear-gradient(135deg, ${org.color}10, ${org.color}05)`
                        e.target.parentElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;opacity:0.5">🌐</div>`
                      }}
                    />
                    {/* Gradient overlay at bottom of image */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px',
                      background: 'linear-gradient(transparent, rgba(255,255,255,0.9))',
                    }} />
                    {/* Tag */}
                    <span style={{
                      position: 'absolute', top: '12px', right: '12px',
                      padding: '5px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                      background: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(8px)',
                      color: org.color,
                      border: `1px solid ${org.color}20`,
                      letterSpacing: '0.03em',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>{org.tag}</span>
                    {/* Live indicator */}
                    <div style={{
                      position: 'absolute', top: '12px', left: '12px',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '20px',
                      background: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#22c55e',
                        animation: 'pulse-soft 2s ease-in-out infinite',
                        boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                      }} />
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>En ligne</span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div style={{ padding: '22px 24px 24px' }}>
                    <h4 style={{
                      fontSize: '16px', fontWeight: 700, color: '#1a1d26',
                      marginBottom: '4px', lineHeight: 1.3,
                    }}>{org.name}</h4>
                    <div style={{
                      fontSize: '11px', color: org.color, fontWeight: 600,
                      marginBottom: '10px', letterSpacing: '0.01em',
                    }}>{org.sub}</div>
                    <p style={{
                      fontSize: '13px', color: '#6b7280', lineHeight: 1.6,
                      margin: '0 0 16px',
                    }}>{org.desc}</p>

                    {/* Visit button */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      paddingTop: '14px',
                      borderTop: '1px solid rgba(0,0,0,0.05)',
                    }}>
                      <span style={{
                        fontSize: '12px', color: '#94a3b8', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <ExternalLink size={12} />
                        {org.url.replace('https://', '').replace('http://', '').split('/')[0]}
                      </span>
                      <span style={{
                        fontSize: '12px', color: org.color, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '5px 14px', borderRadius: '8px',
                        background: `${org.color}08`,
                        border: `1px solid ${org.color}15`,
                        transition: 'all 0.2s',
                      }}>Visiter <ArrowRight size={12} /></span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>


          {/* ── Latest News Cards ──────────────────────────── */}
          <div style={{ marginBottom: '56px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '28px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(59,130,246,0.08))',
                border: '1px solid rgba(79,70,229,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Newspaper size={20} color="#4f46e5" />
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
                Dernières Actualités
              </h3>
              <div style={{
                height: '1px', flex: 1,
                background: 'linear-gradient(90deg, rgba(79,70,229,0.2), rgba(59,130,246,0.1), transparent)',
              }} />
              {/* Page indicators */}
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'center',
                padding: '6px 12px', borderRadius: '20px',
                background: 'rgba(0,0,0,0.02)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}>
                {[0, 1].map(page => (
                  <button
                    key={page}
                    onClick={() => setActiveNews(page)}
                    style={{
                      width: activeNews === page ? '28px' : '10px', height: '10px',
                      borderRadius: '5px', border: 'none', cursor: 'pointer',
                      background: activeNews === page
                        ? 'linear-gradient(135deg, #4f46e5, #3b82f6)'
                        : 'rgba(0,0,0,0.08)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: activeNews === page ? '0 2px 8px rgba(79,70,229,0.4)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Paginated news */}
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '24px' }}>
              <div style={{
                display: 'flex',
                transform: `translateX(-${activeNews * 100}%)`,
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}>
                {/* Page 1 */}
                <div style={{ minWidth: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                  {/* Featured */}
                  <div style={{
                    padding: '36px',
                    borderRadius: '22px',
                    background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(59,130,246,0.03), rgba(14,165,233,0.02))',
                    border: '1px solid rgba(79,70,229,0.1)',
                    position: 'relative', overflow: 'hidden',
                    transition: 'all 0.4s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,70,229,0.25)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 50px rgba(79,70,229,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(79,70,229,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {/* Top gradient line */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                      background: 'linear-gradient(90deg, #4f46e5, #3b82f6, transparent)',
                      borderRadius: '22px 22px 0 0',
                    }} />
                    <div style={{
                      position: 'absolute', top: '-80px', right: '-80px', width: '250px', height: '250px',
                      borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.06), transparent 70%)', filter: 'blur(40px)',
                    }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <span style={{
                          padding: '5px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                          background: 'rgba(52,211,153,0.12)', color: '#34d399',
                          border: '1px solid rgba(52,211,153,0.2)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}>
                          <Sparkles size={10} /> Nouveau
                        </span>
                        <span style={{
                          padding: '5px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                          background: 'rgba(79,70,229,0.1)', color: '#4f46e5',
                          border: '1px solid rgba(79,70,229,0.2)',
                        }}>🇹🇳 Tunisie</span>
                      </div>
                      <h3 style={{ fontSize: '21px', fontWeight: 800, color: '#1a1d26', lineHeight: 1.3, marginBottom: '14px' }}>
                        L'Institut Mongi Ben Hamida lance un programme national de dépistage précoce de la SEP
                      </h3>
                      <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.75, marginBottom: '22px' }}>
                        En collaboration avec le Ministère de la Santé, l'institut déploie un réseau de centres
                        de dépistage dans 12 gouvernorats pour améliorer le diagnostic précoce chez les jeunes adultes tunisiens.
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '5px 12px', borderRadius: '20px',
                          background: 'rgba(0,0,0,0.03)',
                          border: '1px solid rgba(0,0,0,0.06)',
                        }}>
                          <Calendar size={12} color="#71717a" />
                          <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 500 }}>Avril 2026</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#52525b' }}>TAP — Agence Tunis Afrique Presse</span>
                      </div>
                    </div>
                  </div>

                  {/* Side cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                      {
                        badge: 'Recherche', badgeColor: '#818cf8', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(129,140,248,0.03))',
                        title: 'Thérapie par cellules souches : résultats prometteurs en phase III',
                        desc: 'Transplantation autologue stoppe la progression chez 80% des patients traités.',
                        date: 'Mars 2026', source: 'Nature Medicine',
                      },
                      {
                        badge: 'Traitement', badgeColor: '#34d399', gradient: 'linear-gradient(135deg, rgba(52,211,153,0.06), rgba(16,185,129,0.03))',
                        title: 'Nouvel anticorps monoclonal approuvé avec 95% de réduction des poussées',
                        desc: 'La CNAM Tunisie étudie le remboursement de ce traitement révolutionnaire.',
                        date: 'Février 2026', source: 'The Lancet Neurology',
                      },
                    ].map((n, i) => (
                      <div key={i} style={{
                        padding: '24px', borderRadius: '18px',
                        background: n.gradient || '#fff',
                        border: '1px solid rgba(0,0,0,0.06)',
                        transition: 'all 0.4s', flex: 1,
                        position: 'relative', overflow: 'hidden',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${n.badgeColor}35`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${n.badgeColor}08` }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                          background: `linear-gradient(90deg, ${n.badgeColor}, transparent)`,
                          opacity: 0.4,
                        }} />
                        <span style={{
                          display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                          background: `${n.badgeColor}15`, color: n.badgeColor,
                          border: `1px solid ${n.badgeColor}25`, marginBottom: '14px',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>{n.badge}</span>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1d26', lineHeight: 1.4, marginBottom: '10px' }}>{n.title}</h4>
                        <p style={{ fontSize: '12.5px', color: '#6b7280', lineHeight: 1.65, marginBottom: '14px' }}>{n.desc}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          <Calendar size={12} color="#71717a" />
                          <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 500 }}>{n.date} • {n.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Page 2 */}
                <div style={{ minWidth: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  {[
                    {
                      badge: 'Diagnostic', badgeColor: '#38bdf8', emoji: '🧠',
                      gradient: 'linear-gradient(135deg, rgba(56,189,248,0.06), rgba(14,165,233,0.03))',
                      title: 'L\'IA détecte la SEP 5 ans avant les premiers symptômes',
                      desc: 'Des algorithmes de deep learning analysent les micro-changements de la substance blanche cérébrale.',
                      date: 'Janvier 2026', source: 'Science',
                    },
                    {
                      badge: 'Tunisie', badgeColor: '#dc2626', emoji: '🇹🇳',
                      gradient: 'linear-gradient(135deg, rgba(220,38,38,0.05), rgba(220,38,38,0.02))',
                      title: 'Congrès de la STN : focus sur les nouvelles thérapies SEP',
                      desc: 'La Société Tunisienne de Neurologie organise son congrès annuel avec un symposium dédié à la SEP.',
                      date: 'Décembre 2025', source: 'Neuro Tunisia',
                    },
                    {
                      badge: 'Qualité de vie', badgeColor: '#0891b2', emoji: '💪',
                      gradient: 'linear-gradient(135deg, rgba(8,145,178,0.06), rgba(6,182,212,0.03))',
                      title: 'Programme de réhabilitation cognitive : résultats confirmés',
                      desc: 'Stimulation cognitive de 12 semaines améliore significativement la mémoire chez les patients SEP.',
                      date: 'Novembre 2025', source: 'MS Journal',
                    },
                  ].map((n, i) => (
                    <div key={i} style={{
                      padding: '28px', borderRadius: '20px',
                      background: n.gradient || '#fff',
                      border: '1px solid rgba(0,0,0,0.06)',
                      transition: 'all 0.4s',
                      position: 'relative', overflow: 'hidden',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${n.badgeColor}35`; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 50px ${n.badgeColor}08` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                        background: `linear-gradient(90deg, ${n.badgeColor}, transparent)`,
                        opacity: 0.4,
                      }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                        <span style={{
                          padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                          background: `${n.badgeColor}15`, color: n.badgeColor,
                          border: `1px solid ${n.badgeColor}25`,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>{n.badge}</span>
                        <span style={{ fontSize: '22px' }}>{n.emoji}</span>
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1d26', lineHeight: 1.4, marginBottom: '12px' }}>{n.title}</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.65, marginBottom: '16px' }}>{n.desc}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '14px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <Calendar size={12} color="#71717a" />
                        <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 500 }}>{n.date} • {n.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>


          {/* ── SEP en Tunisie — Key Facts ──────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px',
            marginBottom: '56px',
          }}>
            {[
              { number: '~6 000', label: 'Patients SEP en Tunisie', icon: HeartPulse, color: '#4f46e5', gradient: 'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(79,70,229,0.02))' },
              { number: '2.8M', label: 'Cas dans le monde', icon: Globe2, color: '#0891b2', gradient: 'linear-gradient(135deg, rgba(8,145,178,0.08), rgba(8,145,178,0.02))' },
              { number: '75%', label: 'Sont des femmes', icon: Heart, color: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))' },
              { number: '20-40', label: 'Âge du diagnostic', icon: AlertTriangle, color: '#d97706', gradient: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.02))' },
              { number: '85%', label: 'Forme rémittente', icon: Activity, color: '#059669', gradient: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(5,150,105,0.02))' },
            ].map((fact, i) => (
              <div key={i} style={{
                padding: '28px 18px',
                borderRadius: '18px',
                background: fact.gradient,
                border: '1px solid rgba(0,0,0,0.06)',
                textAlign: 'center',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default',
                position: 'relative', overflow: 'hidden',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${fact.color}35`
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.boxShadow = `0 16px 40px ${fact.color}10`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '50%', height: '2px',
                  background: `linear-gradient(90deg, transparent, ${fact.color}50, transparent)`,
                  borderRadius: '0 0 2px 2px',
                }} />
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  background: `${fact.color}12`, border: `1px solid ${fact.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <fact.icon size={22} color={fact.color} />
                </div>
                <div style={{
                  fontSize: '26px', fontWeight: 800, color: '#1a1d26',
                  letterSpacing: '-0.03em', marginBottom: '6px',
                }}>{fact.number}</div>
                <div style={{
                  fontSize: '12px', color: '#6b7280', fontWeight: 500, lineHeight: 1.4,
                }}>{fact.label}</div>
              </div>
            ))}
          </div>


          {/* ── Solidarity Banner ──────────────────────────── */}
          <div style={{
            padding: '36px 40px',
            borderRadius: '24px',
            background: '#fff',
            border: '1px solid rgba(79,70,229,0.1)',
            display: 'flex', alignItems: 'center', gap: '32px',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(79,70,229,0.04)',
          }}>
            {/* Top gradient accent */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: 'linear-gradient(90deg, #4f46e5, #3b82f6, #0891b2, transparent)',
              opacity: 0.6,
              borderRadius: '24px 24px 0 0',
            }} />

            {/* Background decoration */}
            <div style={{
              position: 'absolute', top: '-40px', right: '100px', width: '200px', height: '200px',
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.05), transparent 70%)',
              filter: 'blur(40px)',
            }} />

            {/* Animated heart */}
            <div style={{
              width: '84px', height: '84px', borderRadius: '22px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(59,130,246,0.08))',
              border: '1px solid rgba(79,70,229,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              animation: 'heartbeat 2s ease-in-out infinite',
              boxShadow: '0 8px 32px rgba(79,70,229,0.1)',
            }}>
              <Heart size={36} color="#4f46e5" fill="rgba(79,70,229,0.2)" />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '20px', fontWeight: 800, color: '#1a1d26',
                marginBottom: '8px', letterSpacing: '-0.02em',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '20px' }}>🇹🇳</span> Ensemble, pour chaque patient tunisien
              </h3>
              <p style={{
                fontSize: '14px', color: '#6b7280', lineHeight: 1.75, margin: 0,
                maxWidth: '620px',
              }}>
                De Tunis à Sfax, de Sousse à Gabès — chaque patient SEP mérite un diagnostic précis
                et un suivi de qualité. Notre plateforme IA est notre contribution pour un avenir
                sans Sclérose En Plaques.
              </p>
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              flexShrink: 0, textAlign: 'center',
              padding: '16px 24px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(59,130,246,0.04))',
              border: '1px solid rgba(79,70,229,0.1)',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, color: '#4f46e5',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Journée Mondiale</div>
              <div style={{
                fontSize: '36px', fontWeight: 800,
                background: 'linear-gradient(135deg, #1a1d26, #3a3f4b)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', lineHeight: 1,
              }}>30</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f46e5' }}>Mai</div>
              <div style={{
                marginTop: '4px', padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(79,70,229,0.08)',
                border: '1px solid rgba(79,70,229,0.15)',
                fontSize: '10px', fontWeight: 600, color: '#4f46e5',
              }}>#WorldMSDay</div>
            </div>
          </div>

        </div>
      </section>


      {/* ================================================================
          FINAL CTA SECTION
          ================================================================ */}
      <section style={{
        padding: '100px 48px',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f0f4ff 50%, #f5f3ff 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative */}
        <div style={{
          position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.06), transparent 70%)',
          top: '-200px', right: '-100px', filter: 'blur(60px)',
        }} />

        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(79,70,229,0.3)',
            animation: 'float 3s ease-in-out infinite',
          }}>
            <Brain size={32} color="#fff" />
          </div>

          <h2 style={{
            fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em',
            color: '#1a1d26', margin: '0 0 20px',
          }}>
            Prêt à transformer le{' '}
            <span className="gradient-text">suivi médical</span> ?
          </h2>
          <p style={{
            fontSize: '16px', color: '#5a6070', lineHeight: 1.7,
            marginBottom: '40px', maxWidth: '520px', margin: '0 auto 40px',
          }}>
            Rejoignez Neuro Predict MS et accédez aux outils d'intelligence artificielle
            les plus avancés pour le diagnostic et le suivi de la Sclérose En Plaques.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/inscription')}
              className="btn-primary"
              style={{
                padding: '16px 40px', fontSize: '16px', borderRadius: '14px',
                boxShadow: '0 4px 20px rgba(79,70,229,0.35)',
              }}
            >
              <Sparkles size={18} />
              Créer mon compte
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '16px 32px', borderRadius: '14px',
                border: '1px solid #dfe2e8', background: '#fff',
                fontSize: '16px', fontWeight: 600, color: '#1a1d26',
                cursor: 'pointer', transition: 'all 0.3s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.target.style.borderColor = '#4f46e5' }}
              onMouseLeave={e => { e.target.style.borderColor = '#dfe2e8' }}
            >
              Se connecter
            </button>
          </div>
        </div>
      </section>


      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer style={{
        padding: '40px 48px',
        background: '#1a1d26',
        color: '#94a3b8',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '16px',
        }}>
          {/* Left: App branding + NeuroNova */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src="/logo-sep.png" 
              alt="Neuro Predict MS" 
              style={{ width: '36px', height: '36px', objectFit: 'contain' }} 
            />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>
              Neuro Predict MS
            </span>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 6px' }} />
            <img 
              src="/logo-neuronova.png" 
              alt="NeuroNova" 
              style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} 
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
              par NeuroNova
            </span>
          </div>

          {/* Center: Info */}
          <div style={{ display: 'flex', gap: '24px', fontSize: '13px', alignItems: 'center' }}>
            <span>Plateforme IA Médicale</span>
            <span>•</span>
            <span>Sclérose En Plaques</span>
            <span>•</span>
            <span>© 2026</span>
          </div>

          {/* Right: Social/links */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {[Globe2, Shield, Lock].map((Icon, i) => (
              <div key={i} style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <Icon size={16} color="#94a3b8" />
              </div>
            ))}
          </div>
        </div>
      </footer>


      {/* ================================================================
          ANIMATIONS
          ================================================================ */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.5; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.3; }
          75% { transform: translateY(-30px) translateX(15px); opacity: 0.6; }
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(8px); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbitHero {
          from { transform: rotate(0deg) translateX(200px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(200px) rotate(-360deg); }
        }
        @keyframes orbitHeroInner {
          from { transform: rotate(0deg) translateX(120px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(120px) rotate(-360deg); }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes pulseGlow {
          0% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }
        @keyframes logoGlow {
          0% { box-shadow: 0 0 60px rgba(79,70,229,0.4), 0 0 120px rgba(124,58,237,0.15); }
          100% { box-shadow: 0 0 80px rgba(79,70,229,0.5), 0 0 160px rgba(124,58,237,0.25); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(1); }
          45% { transform: scale(1.1); }
          60% { transform: scale(1); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
          nav { padding: 0 24px !important; }
          section { padding-left: 24px !important; padding-right: 24px !important; }
          footer { padding: 32px 24px !important; }
        }
        @media (max-width: 768px) {
          nav > div:nth-child(2) { display: none !important; }
          nav { gap: 12px !important; }
          h1 { font-size: 36px !important; }
          h2 { font-size: 30px !important; }
        }
      `}</style>
    </div>
  )
}
