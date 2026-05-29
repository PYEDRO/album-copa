import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ImagePlus, Plus, Pencil, Trash2, Save, X, Loader2,
  Sparkles, ChevronLeft, Check, ZoomIn,
} from 'lucide-react'
import { supabase, type DbSticker } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'

// ── Rarity config ────────────────────────────────────────────
const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
type Rarity = typeof RARITIES[number]

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Comum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário',
}
const RARITY_COLORS: Record<Rarity, string> = {
  common:    'bg-slate-100 text-slate-600 border-slate-200',
  rare:      'bg-blue-100 text-blue-700 border-blue-200',
  epic:      'bg-violet-100 text-violet-700 border-violet-200',
  legendary: 'bg-red-100 text-red-700 border-red-200',
}

// ── Mini sticker preview ─────────────────────────────────────
const StickerPreview = ({ form }: { form: Partial<DbSticker> }) => {
  const isLegendary = form.rarity === 'legendary'
  const isRare      = form.rarity === 'rare' || form.rarity === 'epic'
  return (
    <div className={`w-full max-w-[180px] aspect-[3/4] rounded-xl overflow-hidden border-2 shadow-xl mx-auto
      ${isLegendary ? 'border-red-400 bg-gradient-to-b from-red-50 to-white'
        : isRare     ? 'border-amber-300 bg-gradient-to-b from-amber-50 to-white'
                     : 'border-slate-200 bg-white'}`}
    >
      <div className="flex flex-col h-full p-1.5 gap-0.5">
        <div className="flex justify-between text-[5px] font-black uppercase opacity-60 px-0.5">
          <span>{(form.team ?? 'Time')}</span>
          <span>#{form.id || '?'}</span>
        </div>
        <div className={`relative flex-1 rounded overflow-hidden border
          ${isRare ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}
        >
          {form.image_url ? (
            <img src={form.image_url} alt={form.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-30">
              <ImagePlus size={24} className="text-slate-400" />
            </div>
          )}
        </div>
        <div>
          <p className="text-[7px] font-black uppercase truncate text-slate-800 leading-tight">
            {form.name || 'Nome'}
          </p>
          <p className={`text-[5px] font-bold uppercase leading-none truncate
            ${isRare ? 'text-amber-600' : 'text-slate-400'}`}>
            {form.role || 'Função'}
          </p>
        </div>
        <div className={`mt-auto border-t pt-0.5 ${isRare ? 'border-amber-100' : 'border-slate-100'}`}>
          <div className="flex justify-center text-[4px] uppercase font-black">
            <span className={isRare ? 'text-amber-600' : 'text-slate-400'}>
              {isLegendary ? '★★★ Lendário' : isRare ? '★★ Raro' : '★ Comum'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Achievement tag input ────────────────────────────────────
const AchievementInput = ({
  values, onChange,
}: { values: string[]; onChange: (v: string[]) => void }) => {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {values.map((v, i) => (
          <span key={i}
            className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold border border-red-100"
          >
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="hover:text-red-900 transition-colors"><X size={10} /></button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-slate-300 text-xs italic">Nenhuma conquista adicionada</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Ex: 10 anos de empresa"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <button type="button" onClick={add}
          className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg transition-all"
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

// ── ImageCropper — editor interativo de recorte ──────────────
const CROP_W = 270  // px exibidos no editor (proporção 3:4)
const CROP_H = 360

interface CropperProps {
  file: File
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}

const ImageCropper: React.FC<CropperProps> = ({ file, onConfirm, onCancel }) => {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [imgNat, setImgNat] = useState({ w: 1, h: 1 })
  const [applying, setApplying] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragOrigin = useRef({ sx: 0, sy: 0, ox: 0, oy: 0 })

  const imgUrl = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(imgUrl), [imgUrl])

  // Escala base: cabe a imagem dentro do frame (fit)
  const baseScale = Math.min(CROP_W / imgNat.w, CROP_H / imgNat.h)
  // Zoom mínimo: imagem precisa cobrir o frame inteiro (cover)
  const coverScale = Math.max(CROP_W / imgNat.w, CROP_H / imgNat.h)
  const minZoom = imgNat.w > 1 ? coverScale / baseScale : 1
  const maxZoom = minZoom * 3

  const dispW = imgNat.w * baseScale * zoom
  const dispH = imgNat.h * baseScale * zoom

  // Limita offset para a imagem sempre cobrir o frame
  const maxOX = Math.max(0, (dispW - CROP_W) / 2)
  const maxOY = Math.max(0, (dispH - CROP_H) / 2)
  const ox = Math.max(-maxOX, Math.min(maxOX, offset.x))
  const oy = Math.max(-maxOY, Math.min(maxOY, offset.y))

  const imgLeft = CROP_W / 2 - dispW / 2 + ox
  const imgTop  = CROP_H / 2 - dispH / 2 + oy

  const onLoad = () => {
    const img = imgRef.current!
    const { naturalWidth: w, naturalHeight: h } = img
    setImgNat({ w, h })
    // Inicia com cover zoom e sem offset
    const bs = Math.min(CROP_W / w, CROP_H / h)
    const cs = Math.max(CROP_W / w, CROP_H / h)
    setZoom(cs / bs)
    setOffset({ x: 0, y: 0 })
  }

  const startDrag = (cx: number, cy: number) => {
    setDragging(true)
    dragOrigin.current = { sx: cx, sy: cy, ox, oy }
  }

  const moveDrag = (cx: number, cy: number) => {
    if (!dragging) return
    const { sx, sy, ox: sox, oy: soy } = dragOrigin.current
    setOffset({ x: sox + (cx - sx), y: soy + (cy - sy) })
  }

  const stopDrag = () => setDragging(false)

  const handleZoomChange = (v: number) => {
    // Ao mudar zoom via slider, recentra o offset
    setZoom(v)
    setOffset({ x: 0, y: 0 })
  }

  const handleConfirm = () => {
    setApplying(true)
    const img = imgRef.current!
    const scale = baseScale * zoom

    // Converte coordenadas do frame para coordenadas da imagem original
    const srcX = Math.max(0, (0 - imgLeft) / scale)
    const srcY = Math.max(0, (0 - imgTop) / scale)
    const srcW = Math.min(CROP_W / scale, imgNat.w - srcX)
    const srcH = Math.min(CROP_H / scale, imgNat.h - srcY)

    const canvas = document.createElement('canvas')
    canvas.width  = 400   // saída final 3:4
    canvas.height = 533
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 400, 533)

    canvas.toBlob(blob => {
      if (!blob) { onCancel(); return }
      const cropped = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, '') + '_cropped.jpg',
        { type: 'image/jpeg' },
      )
      onConfirm(cropped)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm space-y-5"
      >
        {/* Header */}
        <div>
          <h4 className="text-lg font-black uppercase tracking-tighter text-slate-800">Ajustar Imagem</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Arraste para reposicionar · Slider para zoom
          </p>
        </div>

        {/* Crop frame interativo */}
        <div
          className={`relative mx-auto overflow-hidden rounded-xl border-2 border-red-200 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ width: CROP_W, height: CROP_H }}
          onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY) }}
          onTouchEnd={stopDrag}
        >
          <img
            ref={imgRef}
            src={imgUrl}
            alt="crop preview"
            onLoad={onLoad}
            draggable={false}
            className="absolute pointer-events-none"
            style={{ width: dispW, height: dispH, left: imgLeft, top: imgTop }}
          />

          {/* Guias de terços (regra dos terços) */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), ' +
                  'linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
                backgroundSize: `${CROP_W / 3}px ${CROP_H / 3}px`,
              }}
            />
            {/* Borda do frame */}
            <div className="absolute inset-0 border-2 border-white/40 rounded-xl" />
            {/* Canto TL */}
            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl" />
            {/* Canto TR */}
            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr" />
            {/* Canto BL */}
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl" />
            {/* Canto BR */}
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white rounded-br" />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
              <ZoomIn size={12} />
              <span>Zoom</span>
            </div>
            <span className="text-[10px] font-black text-red-600">{Math.round((zoom / minZoom) * 100)}%</span>
          </div>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            step={0.005}
            value={zoom}
            onChange={e => handleZoomChange(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full accent-red-600 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-300 font-bold">
            <span>Mín</span>
            <span>Máx</span>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase text-xs transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={applying}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black uppercase text-xs transition-all flex items-center justify-center gap-1.5"
          >
            {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Aplicar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Empty form factory ───────────────────────────────────────
function emptyForm(): Partial<DbSticker> {
  return {
    id: '', name: '', role: '', team: '', bio: '',
    rarity: 'common',
    characteristics: { agility: 70, defense: 70, attack: 70 },
    achievements: [],
    image_url: '',
  }
}

// ── Main Component ───────────────────────────────────────────
export default function AdminStickerEditor() {
  const admin = useAdmin()
  const [stickers, setStickers] = useState<DbSticker[]>([])
  const [loadingStickers, setLoadingStickers] = useState(false)
  const [form, setForm] = useState<Partial<DbSticker>>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  // Crop
  const [rawFile, setRawFile] = useState<File | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchStickers = useCallback(async () => {
    setLoadingStickers(true)
    const { data } = await supabase.from('stickers').select('*').order('id')
    if (data) setStickers(data)
    setLoadingStickers(false)
  }, [])

  useEffect(() => { fetchStickers() }, [fetchStickers])

  const nextAutoId = (): string => {
    const numericIds = stickers.map(s => parseInt(s.id, 10)).filter(n => !isNaN(n))
    const max = numericIds.length > 0 ? Math.max(...numericIds) : 0
    return String(max + 1)
  }

  const openCreate = () => {
    setForm({ ...emptyForm(), id: nextAutoId() })
    setEditingId(null)
    setImageFile(null)
    setImagePreview(null)
    setSaveError(null)
    setShowForm(true)
  }

  const openEdit = (s: DbSticker) => {
    setForm({ ...s })
    setEditingId(s.id)
    setImageFile(null)
    setImagePreview(null)
    setSaveError(null)
    setShowForm(true)
  }

  // Abre o cropper interativo ao selecionar arquivo
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRawFile(file)
    setShowCropper(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Carrega a imagem atual (URL) no cropper sem precisar re-upload
  const [loadingCrop, setLoadingCrop] = useState(false)
  const openCropperForCurrentImage = async () => {
    const url = imagePreview ?? form.image_url
    if (!url) return
    setLoadingCrop(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : 'jpg'
      const file = new File([blob], `sticker_atual.${ext}`, { type: blob.type })
      setRawFile(file)
      setShowCropper(true)
    } catch {
      alert('Não foi possível carregar a imagem atual para recorte.')
    } finally {
      setLoadingCrop(false)
    }
  }

  // Callback do cropper: recebe arquivo recortado
  const handleCropConfirm = (croppedFile: File) => {
    setShowCropper(false)
    setRawFile(null)
    setImageFile(croppedFile)
    const url = URL.createObjectURL(croppedFile)
    setImagePreview(url)
    setForm(f => ({ ...f, image_url: url }))
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setRawFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    try {
      let imageUrl = form.image_url ?? ''

      if (imageFile) {
        const stickerId = (editingId ?? form.id ?? `s${Date.now()}`).trim() || `s${Date.now()}`
        setUploadProgress(true)
        const uploaded = await admin.uploadStickerImage(imageFile, stickerId)
        setUploadProgress(false)
        if (!uploaded) throw new Error('Falha no upload da imagem. Verifique o bucket no Supabase.')
        imageUrl = uploaded
        setForm(f => ({ ...f, image_url: uploaded, id: stickerId }))
      }

      const payload: Partial<DbSticker> = { ...form, image_url: imageUrl }

      if (editingId) {
        const err = await admin.updateSticker(editingId, payload)
        if (err) throw new Error(err.message)
      } else {
        const err = await admin.createSticker(payload as Omit<DbSticker, 'id'> & { id?: string })
        if (err) throw new Error(err.message)
      }

      await fetchStickers()
      setShowForm(false)
      setForm(emptyForm())
      setEditingId(null)
      setImageFile(null)
      setImagePreview(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const err = await admin.deleteSticker(id)
    if (err) {
      setDeleteError(err.message)
      return
    }
    setDeleteConfirm(null)
    setDeleteError(null)
    await fetchStickers()
  }

  const rarityBg: Record<Rarity, string> = {
    common: 'bg-slate-50', rare: 'bg-blue-50', epic: 'bg-violet-50', legendary: 'bg-red-50',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-red-600">
            Editor de Figurinhas
          </h2>
          <p className="text-slate-400 font-medium mt-1">
            Cadastre e edite as figurinhas do álbum
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl font-black text-sm transition-all shadow-lg"
        >
          <Plus size={18} />Nova Figurinha
        </button>
      </div>

      {/* Sticker Grid */}
      {loadingStickers ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={36} className="animate-spin text-red-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {stickers.map(s => (
            <motion.div key={s.id} layout
              className={`rounded-xl border overflow-hidden group cursor-pointer transition-shadow hover:shadow-lg ${rarityBg[s.rarity as Rarity] ?? 'bg-slate-50'}`}
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <ImagePlus size={28} className="text-slate-300" />
                  </div>
                )}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${RARITY_COLORS[s.rarity as Rarity]}`}>
                  {RARITY_LABELS[s.rarity as Rarity]}
                </div>
              </div>
              <div className="p-2">
                <p className="text-[10px] font-black uppercase truncate text-slate-800">{s.name}</p>
                <p className="text-[8px] text-slate-400 font-medium truncate">{s.role}</p>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => openEdit(s)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-[9px] font-black uppercase transition-all"
                  ><Pencil size={10} />Edit</button>
                  <button onClick={() => setDeleteConfirm(s.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-white border border-slate-200 hover:border-red-400 hover:text-red-600 rounded-lg text-[9px] font-black uppercase transition-all"
                  ><Trash2 size={10} />Del</button>
                </div>
              </div>
            </motion.div>
          ))}
          {stickers.length === 0 && (
            <div className="col-span-full text-center py-24 text-slate-300 font-black italic uppercase">
              <Sparkles size={36} className="mx-auto mb-3 opacity-30" />
              Nenhuma figurinha cadastrada ainda
            </div>
          )}
        </div>
      )}

      {/* ── Cropper Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showCropper && rawFile && (
          <ImageCropper
            file={rawFile}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        )}
      </AnimatePresence>

      {/* ── Form Slide-over ──────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 z-[66] w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
            >
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {/* Form Header */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-red-600">
                      {editingId ? 'Editar Figurinha' : 'Nova Figurinha'}
                    </h3>
                    <p className="text-slate-400 text-xs font-medium mt-0.5">
                      {editingId ? `ID: ${editingId}` : 'Preencha os dados abaixo'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
                    <ChevronLeft size={22} />
                  </button>
                </div>

                {/* Preview + Image Upload */}
                <div className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-[180px]">
                    <StickerPreview form={{ ...form, image_url: imagePreview ?? form.image_url }} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Imagem</p>
                    <input ref={fileRef} type="file" accept="image/*"
                      onChange={handleImageChange} className="hidden" />
                    {imagePreview || form.image_url ? (
                      <div className="space-y-2">
                        <img
                          src={imagePreview ?? form.image_url}
                          alt="preview"
                          className="w-full max-h-48 object-contain rounded-xl border border-slate-200 bg-slate-50"
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={openCropperForCurrentImage}
                            disabled={loadingCrop}
                            className="flex-1 py-2 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl text-xs font-black uppercase text-amber-500 hover:text-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {loadingCrop ? <Loader2 size={14} className="animate-spin" /> : <ZoomIn size={14} />}
                            Recortar
                          </button>
                          <button type="button" onClick={() => fileRef.current?.click()}
                            className="flex-1 py-2 border-2 border-dashed border-slate-200 hover:border-red-400 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-red-600 transition-all flex items-center justify-center gap-2">
                            <ImagePlus size={14} />Trocar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="w-full py-10 border-2 border-dashed border-slate-200 hover:border-red-400 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:text-red-500 transition-all">
                        <ImagePlus size={28} />
                        <span className="text-xs font-black uppercase tracking-wider">Carregar imagem</span>
                        <span className="text-[10px] text-slate-300">PNG, JPG, WEBP · Recorte manual 3:4</span>
                      </button>
                    )}
                    {uploadProgress && (
                      <div className="flex items-center gap-2 text-xs text-red-500 font-black">
                        <Loader2 size={14} className="animate-spin" />Enviando imagem...
                      </div>
                    )}
                    {/* Optional image URL override */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Ou cole uma URL
                      </label>
                      <input
                        value={imagePreview ? '' : (form.image_url ?? '')}
                        onChange={e => { setImageFile(null); setImagePreview(null); setForm(f => ({ ...f, image_url: e.target.value })) }}
                        placeholder="https://..."
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Basic Fields */}
                <div className="grid grid-cols-2 gap-4">
                  {!editingId && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        ID <span className="text-emerald-500 normal-case font-bold tracking-normal">· preenchido automaticamente</span>
                      </label>
                      <input required value={form.id ?? ''} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                        placeholder="ID gerado automaticamente"
                        className="w-full border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 text-emerald-800 font-bold" />
                      <p className="text-[9px] text-slate-400 mt-1">Você pode alterar o ID manualmente se necessário.</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Nome *</label>
                    <input required value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nome completo"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Função / Cargo *</label>
                    <input required value={form.role ?? ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                      placeholder="Ex: Desenvolvedor Frontend"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Setor / Time *</label>
                    <input required value={form.team ?? ''} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                      placeholder="Ex: Produto &amp; Design"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                  </div>
                </div>

                {/* Rarity */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Raridade *</label>
                  <div className="flex gap-2 flex-wrap">
                    {RARITIES.map(r => (
                      <button key={r} type="button"
                        onClick={() => setForm(f => ({ ...f, rarity: r }))}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all
                          ${form.rarity === r ? RARITY_COLORS[r] + ' scale-105 shadow-md' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        {RARITY_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Talentos Ocultos</label>
                  <textarea
                    value={form.bio ?? ''}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    rows={3}
                    placeholder="Uma frase que descreve esse talento..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                </div>

                {/* Achievements */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Conquistas
                  </label>
                  <AchievementInput
                    values={form.achievements ?? []}
                    onChange={v => setForm(f => ({ ...f, achievements: v }))}
                  />
                </div>

                {/* Error */}
                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                    {saveError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-black uppercase text-xs text-slate-600 transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black uppercase text-xs transition-all shadow-lg">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editingId ? 'Salvar Alterações' : 'Criar Figurinha'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setDeleteConfirm(null); setDeleteError(null) }} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl z-10 text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-red-100">
              <Trash2 size={28} className="text-red-600" />
            </div>
            <div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
                Excluir Figurinha?
              </h4>
              <p className="text-slate-500 text-sm mt-2 font-medium">
                ID: <strong>{deleteConfirm}</strong>. Esta ação também remove a figurinha dos álbuns de todos os usuários.
              </p>
            </div>
            {deleteError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl p-3">
                Erro: {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteConfirm(null); setDeleteError(null) }}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-black uppercase text-xs text-slate-600 transition-all">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs transition-all">
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
