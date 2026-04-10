import { useEffect, useState } from 'react'
import { User, Calendar, Mail, Phone, Activity, Brain, Shield, Heart } from 'lucide-react'
import { patientPortalService } from '../../services/patientPortalService'

export default function MonDossier() {
  const [dossier, setDossier] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await patientPortalService.getMonDossier()
        setDossier(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9ca3b0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', marginBottom: '16px',
        border: '2.5px solid #eef0f4', borderTopColor: '#4f46e5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '14px' }}>Chargement de votre dossier…</span>
    </div>
  )

  if (!dossier) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px', margin: '0 auto 14px',
        background: '#fef2f2', border: '1px solid #fecaca',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <User size={24} color="#dc2626" />
      </div>
      <div style={{ fontWeight: 600, color: '#1a1d26', marginBottom: '6px' }}>Dossier non trouvé</div>
      <div style={{ color: '#9ca3b0', fontSize: '14px' }}>Contactez votre médecin pour lier votre dossier.</div>
    </div>
  )

  const patient = dossier.patient
  const resume = dossier.resume

  return (
    <div className="animate-fadeIn" style={{ color: '#1a1d26' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
          Mon dossier médical
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '6px' }}>
          Vos informations personnelles et votre résumé clinique
        </p>
      </div>

      {/* Patient Card */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        borderRadius: '20px', padding: '32px',
        marginBottom: '24px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(79, 70, 229, 0.2)',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', right: '60px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 700, color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            flexShrink: 0,
          }}>
            {patient.prenom?.[0]}{patient.nom?.[0]}
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {patient.prenom} {patient.nom}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.2)', color: '#fff',
              }}>
                {patient.sexe === 'F' ? 'Féminin' : 'Masculin'}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                Né(e) le {patient.date_naissance}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Informations personnelles */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#eef2ff', border: '1px solid #c7d2fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={17} color="#4f46e5" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>
              Informations personnelles
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {[
              { icon: User, label: 'Nom complet', value: `${patient.prenom} ${patient.nom}` },
              { icon: Calendar, label: 'Date de naissance', value: patient.date_naissance },
              { icon: Mail, label: 'Email', value: patient.contact?.email || '—' },
              { icon: Phone, label: 'Téléphone', value: patient.contact?.telephone || '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#f8f9fc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={15} color="#9ca3b0" />
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#9ca3b0', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1a1d26', margin: '3px 0 0' }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Résumé clinique */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#ecfdf5', border: '1px solid #a7f3d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Heart size={17} color="#059669" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1d26', margin: 0 }}>
              Résumé clinique
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              { label: 'Visites', value: resume.total_visites, icon: Activity, gradient: 'stat-gradient-blue', color: '#2563eb' },
              { label: 'IRM réalisées', value: resume.total_irm, icon: Brain, gradient: 'stat-gradient-violet', color: '#7c3aed' },
              { label: 'Dernier EDSS', value: resume.dernier_edss ?? '—', icon: Shield, gradient: 'stat-gradient-amber', color: '#d97706' },
            ].map(({ label, value, icon: Icon, gradient, color }) => (
              <div key={label} className={gradient} style={{ borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px', margin: '0 auto 12px',
                  background: `${color}12`, border: `1px solid ${color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} color={color} />
                </div>
                <p style={{ fontSize: '32px', fontWeight: 700, color, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
                <p style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginTop: '6px' }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '16px', padding: '14px 16px', borderRadius: '10px',
            background: '#f8f9fc', border: '1px solid #eef0f4',
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
              💡 <strong>Note :</strong> Ces informations sont mises à jour par votre médecin traitant. 
              Pour toute question, consultez lors de votre prochaine visite.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
