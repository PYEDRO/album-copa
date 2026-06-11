# 📝 CHANGELOG: Aumento de Raridades (Epic + Legendary 10x)

**Data**: 2026-06-11  
**Versão**: 2.0  
**Alteração**: Aumentado 10x as chances de Epic e Legendary

---

## 📊 Antes vs Depois

### Probabilidades Anteriores (v1.0)

```
common:    72/100 = 72.0%
rare:      21/100 = 21.0%
epic:       5/100 =  5.0%
legendary:  2/100 =  2.0%
```

### Probabilidades Novas (v2.0)

```
common:     72/163 = 44.2%  (↓ 27.8%)
rare:       21/163 = 12.9%  (↓ 8.1%)
epic:       50/163 = 30.7%  (↑ 25.7%) 🚀
legendary:  20/163 = 12.3%  (↑ 10.3%) 🔥
```

---

## 🎲 Chance por Acerto (para cada raridade)

| Tipo | Antes | Depois | Mudança |
|------|-------|--------|---------|
| 🟤 Comum | 1/1.39 | 1/2.26 | -38% |
| 🔵 Raro | 1/4.76 | 1/7.76 | -40% |
| 🟣 Épico | 1/20 | 1/3.26 | **+512%** |
| 🔴 Lendário | 1/50 | 1/8.15 | **+513%** |

---

## 📈 Valor Esperado (quantos acertos até ganhar 1?)

| Raridade | Antes | Depois |
|----------|-------|--------|
| 🟤 Comum | ~1.39 | ~2.26 |
| 🔵 Raro | ~4.76 | ~7.76 |
| 🟣 Épico | **20 acertos** | **3.26 acertos** | ✨ Quase 6x mais rápido!
| 🔴 Lendário | **50 acertos** | **8.15 acertos** | ✨ Quase 6x mais rápido!

---

## 🎯 Impacto Prático (5 acertos/dia máximo)

### Estatística Diária

**Antes (v1.0):**
- 🟣 Epic: 25% chance de ganhar 1 epic por dia
- 🔴 Legendary: 10% chance de ganhar 1 legendary por dia

**Depois (v2.0):**
- 🟣 Epic: **79.5% chance** de ganhar ≥1 epic por dia ⬆️
- 🔴 Legendary: **48.5% chance** de ganhar ≥1 legendary por dia ⬆️

---

## 👥 Impacto para Usuários

### Novo Jogador (0 cartas)

**Antes:**
- Precisa acertar ~20 vezes para ganhar 1 épica
- Precisa acertar ~50 vezes para ganhar 1 lendária

**Depois:**
- Precisa acertar ~3.3 vezes para ganhar 1 épica ✅
- Precisa acertar ~8.2 vezes para ganhar 1 lendária ✅

### Jogador Regular (5 acertos/dia)

**Antes:**
- ~1 epic a cada 4 dias
- ~1 legendary a cada 10 dias

**Depois:**
- ~1 epic a cada 0.65 dias (quase todo dia!) ✅
- ~1 legendary a cada 1.6 dias (a cada 2 dias) ✅

---

## 🔍 Código Modificado

**Arquivo:** `supabase/functions/claim-game-reward/index.ts`

**Antes:**
```typescript
const GAME_REWARD_WEIGHTS = {
  common: 72,
  rare: 21,
  epic: 5,
  legendary: 2,
}
```

**Depois:**
```typescript
const GAME_REWARD_WEIGHTS = {
  common: 72,
  rare: 21,
  epic: 50,      // ← AUMENTADO (5 → 50)
  legendary: 20, // ← AUMENTADO (2 → 20)
}
```

---

## ✅ Compatibilidade

- ✅ Sem mudança de schema
- ✅ Sem downtime
- ✅ Compatível com dados existentes
- ✅ Sem quebra de lógica
- ✅ Pack/Booster continuam normais

---

## 🚀 Deploy

1. ✅ Código modificado (edge function)
2. Redeploy automático
3. Entra em vigor imediatamente

**Sem migration necessária** ✅

---

## 💡 Rationale

**Por que aumentar:**
- Epic/Legendary eram muito raros (5% e 2%)
- Usuários nunca completavam álbum em tempo razoável
- Satisfação baixa (muitas comuns/raras repetidas)

**Por que 10x especificamente:**
- Epic: 5% → 30.7% (mais comum que raro, fair)
- Legendary: 2% → 12.3% (ainda raro, mas obtível)
- Comum: mantém 44% (ainda maioria, suporta distribição)

**Resultado:**
- Jogo mais satisfatório
- Álbum coletável em semanas, não meses
- Mantém valor de legendary (ainda 12%, não 50%)

---

## 🎲 Simulação (100 acertos)

### Antes (v1.0)
```
Comum:    ~72 cartas
Raro:     ~21 cartas
Épica:    ~5 cartas
Legendária: ~2 cartas
```

### Depois (v2.0)
```
Comum:    ~44 cartas
Raro:     ~13 cartas
Épica:    ~31 cartas
Legendária: ~12 cartas
```

**Mudança:** Muito mais épicas e lendárias! 🎉

---

## 📞 Rollback (se necessário)

Se precisar reverter para v1.0:
```typescript
const GAME_REWARD_WEIGHTS = {
  common: 72,
  rare: 21,
  epic: 5,      // voltar para 5
  legendary: 2, // voltar para 2
}
```

Sem migration, sem downtime.

---

**Status:** ✅ Implementado e pronto para produção
