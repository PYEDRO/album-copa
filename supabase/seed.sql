-- ============================================================
-- SEED: Stickers catalog — Álbum da Copa: Talentos Tech
-- Run after migration 001_initial_schema.sql
-- ============================================================

INSERT INTO public.stickers (id, name, role, team, rarity, characteristics, image_url, bio, achievements)
VALUES

-- ── ESQUADRÃO CODE BUILDERS ──────────────────────────────────
('1', 'Ana Silva', 'Fullstack Developer', 'Esquadrão Code Builders', 'common',
  '{"agility": 85, "defense": 70, "attack": 75}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana',
  'Especialista em resolver mistérios de console.log no meio da madrugada.',
  ARRAY['Bug Hunter', 'Refactoring Master']),

('2', 'Hugo Rocha', 'Backend Dev', 'Esquadrão Code Builders', 'common',
  '{"agility": 80, "defense": 90, "attack": 65}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Hugo',
  'Fala fluentemente JSON e se alimenta de café gelado.',
  ARRAY['SQL Ninja', 'API Sculptor']),

('3', 'Fabio Santos', 'DevOps Engineer', 'Esquadrão Code Builders', 'rare',
  '{"agility": 90, "defense": 85, "attack": 70}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Fabio',
  'Se caiu, ele sobe. Se demorou, ele automatiza.',
  ARRAY['Pipeline Wizard', 'Cloud Guardian']),

('13', 'Leticia Borges', 'Frontend Dev', 'Esquadrão Code Builders', 'common',
  '{"agility": 88, "defense": 60, "attack": 92}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leticia',
  'Transformou um Figma de 200 telas em componentes em 3 dias. Sozinha.',
  ARRAY['Pixel Slayer', 'CSS Whisperer']),

('14', 'Rafael Torres', 'Mobile Dev', 'Esquadrão Code Builders', 'epic',
  '{"agility": 93, "defense": 72, "attack": 88}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Rafael',
  'Faz apps nativos e cross-platform antes do café esfriar.',
  ARRAY['App Store Champion', 'Crash-Free Streak']),

-- ── LIGA DOS GUARDIÕES ────────────────────────────────────────
('4', 'Carla Dias', 'Security Lead', 'Liga dos Guardiões', 'legendary',
  '{"agility": 80, "defense": 98, "attack": 85}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Carla',
  'Capaz de prever um erro de produção antes mesmo do commit ser feito.',
  ARRAY['System Architect', 'Legendary Debugger']),

('5', 'Marcos Pires', 'Infra Specialist', 'Liga dos Guardiões', 'common',
  '{"agility": 75, "defense": 92, "attack": 60}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcos',
  'Mantém os servidores respirando mesmo sob o ataque de mil bots.',
  ARRAY['Uptime King']),

('15', 'Thais Cavalcanti', 'QA Engineer', 'Liga dos Guardiões', 'rare',
  '{"agility": 78, "defense": 96, "attack": 70}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Thais',
  'Encontra bugs em features que ainda não foram desenvolvidas.',
  ARRAY['Zero Defect', 'Edge Case Hunter']),

-- ── ARQUITETOS DE EXPERIÊNCIA ─────────────────────────────────
('6', 'Diego Lima', 'UX Designer', 'Arquitetos de Experiência', 'common',
  '{"agility": 60, "defense": 65, "attack": 95}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Diego',
  'Transformando wireframes feios em experiências mágicas desde sempre.',
  ARRAY['Pixel Perfect', 'User Advocate']),

('7', 'Julia Mendes', 'Product Designer', 'Arquitetos de Experiência', 'rare',
  '{"agility": 75, "defense": 70, "attack": 88}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Julia',
  'A maior inimiga do desalinhamento de 1px.',
  ARRAY['Color Master', 'Component Queen']),

('16', 'Anderson Freire', 'Product Manager', 'Arquitetos de Experiência', 'epic',
  '{"agility": 82, "defense": 78, "attack": 90}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Anderson',
  'Traduz caos de stakeholders em roadmaps que fazem sentido.',
  ARRAY['Roadmap Wizard', 'Backlog Slayer']),

-- ── CENTRAL DE INTELIGÊNCIA ───────────────────────────────────
('8', 'Beto Lima', 'Data Scientist', 'Central de Inteligência', 'rare',
  '{"agility": 70, "defense": 75, "attack": 92}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Beto',
  'Vê padrões onde outros veem apenas caos de bytes.',
  ARRAY['Python Snake', 'Matrix Navigator']),

('9', 'Renata J.', 'BI Analyst', 'Central de Inteligência', 'common',
  '{"agility": 80, "defense": 80, "attack": 80}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Renata',
  'Transforma planilhas em histórias que fazem os diretores chorarem de emoção.',
  ARRAY['Dashboard Artist']),

('17', 'Camila Esteves', 'ML Engineer', 'Central de Inteligência', 'epic',
  '{"agility": 76, "defense": 82, "attack": 96}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Camila',
  'Treinou um modelo que previu o churning antes do cliente saber que ia cancelar.',
  ARRAY['Model Whisperer', 'GPU Tamer']),

-- ── SUPORTE TÁTICO ────────────────────────────────────────────
('10', 'Léo Nunes', 'Customer Success', 'Suporte Tático', 'common',
  '{"agility": 95, "defense": 95, "attack": 60}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'O escudo humano entre a fúria do cliente e a paz do dev.',
  ARRAY['Zen Master', 'First Responder']),

('11', 'Gisele Melo', 'HR Director', 'Suporte Tático', 'rare',
  '{"agility": 70, "defense": 75, "attack": 85}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Gisele',
  'A guardiã da cultura e dos melhores happy hours da empresa.',
  ARRAY['Talent Scout', 'Culture Builder']),

-- ── CORPORATE / SPECIAL ───────────────────────────────────────
('12', 'Bruno Souza', 'CEO / Founder', 'Corporate', 'legendary',
  '{"agility": 95, "defense": 90, "attack": 98}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bruno',
  'O lendário arquiteto de sonhos e planilhas complexas.',
  ARRAY['Visionary', 'Deal Maker']),

('18', 'Patricia Queiroz', 'CFO', 'Corporate', 'epic',
  '{"agility": 85, "defense": 94, "attack": 88}',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Patricia',
  'Faz o budget do ano em uma reunião. E ainda sobra tempo para o almoço.',
  ARRAY['Number Crusher', 'Cost Killer'])

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED: Quiz questions
-- ============================================================

INSERT INTO public.quiz_questions (question, options, correct_answer, related_sticker_id)
VALUES
  ('Qual colaborador é conhecido como "Legendary Debugger"?',
   ARRAY['Bruno Souza', 'Carla Dias', 'Fabio Santos', 'Rafael Torres'],
   'Carla Dias', '4'),

  ('Quem é o CEO / Founder da empresa?',
   ARRAY['Marcos Pires', 'Bruno Souza', 'Anderson Freire', 'Beto Lima'],
   'Bruno Souza', '12'),

  ('Qual time é responsável pela infraestrutura e segurança?',
   ARRAY['Suporte Tático', 'Central de Inteligência', 'Liga dos Guardiões', 'Corporate'],
   'Liga dos Guardiões', NULL),

  ('Qual colaboradora treinou um modelo de ML para prever churn?',
   ARRAY['Renata J.', 'Patricia Queiroz', 'Camila Esteves', 'Julia Mendes'],
   'Camila Esteves', '17'),

  ('Qual Dev é conhecido pela conquista "Pipeline Wizard"?',
   ARRAY['Hugo Rocha', 'Ana Silva', 'Fabio Santos', 'Rafael Torres'],
   'Fabio Santos', '3')

ON CONFLICT DO NOTHING;
