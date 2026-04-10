import { useEffect, useState } from 'react'
import { Brain, Clock, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'
import api from '../services/api'
import ViewerIRM from '../components/irm/ViewerIRM'

const STATUT_CONFIG = {
  pending: { label: 'En attente', color: 'bg-orange-100 text-orange-700', icon: Clock },
  processing: { label: 'En traitement', color: 'bg-blue-100 text-blue-700', icon: Brain },
  done: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  analysee: { label: 'Analysée', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  error: { label: 'Erreur', color: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function IRMQueue() {
  const [irms, setIrms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('all')
  const [viewerOuvert, setViewerOuvert] = useState(null) // id IRM avec viewer ouvert

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Utiliser l'endpoint dédié au radiologue
        const pRes = await api.get('/patients/?limit=100')
        const patients = pRes.data.data || []
        let all = []
        for (const p of patients) {
          const iRes = await api.get(`/patients/${p.id}/irm/`)
          const irmsPatient = iRes.data.data || []
          const withPatient = irmsPatient.map(irm => ({
            ...irm,
            patient_nom: `${p.prenom} ${p.nom}`,
            patient_id: p.id,
          }))
          all = [...all, ...withPatient]
        }
        all.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
        setIrms(all)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const filtered = filtre === 'all' ? irms : irms.filter(i => i.statut === filtre)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">File d'attente IRM</h1>
        <p className="text-gray-500 mt-1">{irms.length} IRM au total</p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: irms.length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'En attente', value: irms.filter(i => i.statut === 'pending').length, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Analysées', value: irms.filter(i => i.statut === 'analysee').length, color: '#8b5cf6', bg: '#f3e8ff' },
          { label: 'Terminées', value: irms.filter(i => i.statut === 'done').length, color: '#22c55e', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', borderRadius: '12px', padding: '16px 20px',
            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px'
          }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px',
              background: s.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: s.color
            }}>{s.value}</div>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'analysee', 'done'].map(s => (
          <button key={s} onClick={() => setFiltre(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtre === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'Toutes' : STATUT_CONFIG[s]?.label}
            <span className="ml-2 text-xs opacity-75">
              ({s === 'all' ? irms.length : irms.filter(i => i.statut === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Liste avec viewer intégré */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
          Aucune IRM trouvée
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(irm => {
            const config = STATUT_CONFIG[irm.statut] || STATUT_CONFIG.pending
            const Icon = config.icon
            const viewerVisible = viewerOuvert === irm.id

            return (
              <div key={irm.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Ligne principale */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain size={18} className="text-blue-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{irm.patient_nom}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {irm.sequence_type || 'IRM'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex gap-3">
                      {irm.metadata?.hauteur && irm.metadata?.nb_slices && (
                        <span>{irm.metadata.hauteur}×{irm.metadata.largeur || '?'}×{irm.metadata.nb_slices} voxels</span>
                      )}
                      {irm.metadata?.taille_mb && <span>{irm.metadata.taille_mb} MB</span>}
                      <span>{new Date(irm.uploaded_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Statut */}
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
                      <Icon size={12} /> {config.label}
                    </span>

                    {/* Rapport IA */}
                    {irm.rapport?.segmentation_ia && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                        IA ✓ {irm.rapport.segmentation_ia.volume_lesions_voxels} vox
                      </span>
                    )}

                    {/* Bouton viewer */}
                    <button
                      onClick={() => setViewerOuvert(viewerVisible ? null : irm.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewerVisible
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {viewerVisible ? <><EyeOff size={15} /> Fermer</> : <><Eye size={15} /> Visualiser</>}
                    </button>
                  </div>
                </div>

                {/* Viewer IRM */}
                {viewerVisible && (
                  <div className="px-6 pb-6 border-t border-gray-50 pt-4">
                    <ViewerIRM
                      patientId={irm.patient_id}
                      irmId={irm.id}
                      sequenceType={irm.sequence_type}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}