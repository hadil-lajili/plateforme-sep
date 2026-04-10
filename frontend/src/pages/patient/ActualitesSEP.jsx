import { useEffect, useState } from 'react'
import { Newspaper, ExternalLink, Search, FlaskConical, Heart, BookOpen, MessageCircle, Sparkles } from 'lucide-react'
import { patientPortalService } from '../../services/patientPortalService'

const CATEGORIES = [
  { key: '', label: 'Toutes', icon: Sparkles, color: '#4f46e5' },
  { key: 'Traitements', label: 'Traitements', icon: FlaskConical, color: '#7c3aed' },
  { key: 'Recherche', label: 'Recherche', icon: BookOpen, color: '#059669' },
  { key: 'Vie quotidienne', label: 'Vie quotidienne', icon: Heart, color: '#d97706' },
  { key: 'Témoignages', label: 'Témoignages', icon: MessageCircle, color: '#db2777' },
]

const categoryStyles = {
  'Traitements': { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', icon: FlaskConical },
  'Recherche': { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', icon: BookOpen },
  'Vie quotidienne': { bg: '#fffbeb', color: '#d97706', border: '#fcd34d', icon: Heart },
  'Témoignages': { bg: '#fdf2f8', color: '#db2777', border: '#f9a8d4', icon: MessageCircle },
}

export default function ActualitesSEP() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await patientPortalService.getActualites()
        setArticles(res.data.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const filteredArticles = articles.filter(a => {
    const matchCategory = !activeCategory || a.categorie === activeCategory
    const matchSearch = !searchQuery || 
      a.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.resume.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9ca3b0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', marginBottom: '16px',
        border: '2.5px solid #eef0f4', borderTopColor: '#4f46e5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '14px' }}>Chargement des actualités…</span>
    </div>
  )

  return (
    <div className="animate-fadeIn" style={{ color: '#1a1d26' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1d26', margin: 0, letterSpacing: '-0.02em' }}>
          Actualités SEP
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '6px' }}>
          Restez informé(e) sur la sclérose en plaques — traitements, recherche et vie quotidienne
        </p>
      </div>

      {/* Search + Categories */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '360px' }}>
          <Search size={15} style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: '#9ca3b0', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Rechercher un article…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-light"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key
            const Icon = cat.icon
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '10px',
                  border: isActive ? `1.5px solid ${cat.color}40` : '1.5px solid #e2e5eb',
                  background: isActive ? `${cat.color}08` : '#fff',
                  color: isActive ? cat.color : '#5a6070',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                }}
              >
                <Icon size={13} />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Articles Grid */}
      {filteredArticles.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 0',
          background: '#fff', borderRadius: '16px', border: '1px solid #eef0f4',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px', margin: '0 auto 16px',
            background: '#fdf2f8', border: '1px solid #f9a8d4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Newspaper size={26} color="#db2777" />
          </div>
          <div style={{ fontWeight: 600, color: '#1a1d26', fontSize: '16px', marginBottom: '6px' }}>Aucun article trouvé</div>
          <div style={{ color: '#9ca3b0', fontSize: '14px' }}>Essayez une autre catégorie ou un autre terme de recherche</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {filteredArticles.map((article, i) => {
            const cat = categoryStyles[article.categorie] || categoryStyles['Recherche']
            const CatIcon = cat.icon
            return (
              <div
                key={article.id}
                className="glass-card-glow"
                style={{
                  padding: '0', overflow: 'hidden',
                  animation: `slideUp 0.4s ease-out ${i * 60}ms backwards`,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (article.lien && article.lien !== '#') {
                    window.open(article.lien, '_blank')
                  }
                }}
              >
                {/* Category color bar */}
                <div style={{ height: '4px', background: `linear-gradient(90deg, ${cat.color}, ${cat.color}80)` }} />

                <div style={{ padding: '22px' }}>
                  {/* Category + Date */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px',
                      background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
                    }}>
                      <CatIcon size={11} />
                      {article.categorie}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3b0' }}>
                      {new Date(article.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: '15px', fontWeight: 700, color: '#1a1d26',
                    margin: '0 0 8px', lineHeight: 1.4, letterSpacing: '-0.01em',
                  }}>
                    {article.titre}
                  </h3>

                  {/* Summary */}
                  <p style={{
                    fontSize: '13px', color: '#6b7280', margin: '0 0 14px',
                    lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {article.resume}
                  </p>

                  {/* Source + Link */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3b0', fontWeight: 500 }}>
                      Source : {article.source}
                    </span>
                    {article.lien && article.lien !== '#' && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '12px', color: '#4f46e5', fontWeight: 600,
                      }}>
                        Lire <ExternalLink size={11} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      <div style={{
        marginTop: '24px', padding: '14px 18px', borderRadius: '12px',
        background: '#f8f9fc', border: '1px solid #eef0f4',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '12px', color: '#9ca3b0', margin: 0 }}>
          💡 Ces articles sont fournis à titre informatif. Consultez toujours votre médecin pour toute décision médicale.
        </p>
      </div>
    </div>
  )
}
