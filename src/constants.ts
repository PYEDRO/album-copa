import { Rarity, Collaborator, UserStats } from './types';

// Limite máximo de figurinhas do álbum. O roster real (tabela `stickers` no
// banco) é a fonte de verdade; este valor é o teto que o álbum exibe e que o
// admin pode cadastrar.
export const MAX_STICKERS = 80;

export const TEAMS = [
  'Esquadrão Code Builders',
  'Liga dos Guardiões',
  'Arquitetos de Experiência',
  'Central de Inteligência',
  'Suporte Tático'
];

export const COLLABORATORS: Collaborator[] = [
  // Page 1: Esquadrão Code Builders (11 stickers)
  {
    id: '1',
    name: 'Ana Silva',
    role: 'Tech Lead',
    team: 'Esquadrão Code Builders',
    rarity: Rarity.LEGENDARY,
    attributes: { agility: 95, defense: 88, attack: 92 },
    achievements: ['Bug Hunter', 'Refactoring Master'],
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana', // Troque pelo link da foto real
    bio: 'Especialista em resolver mistérios de console.log no meio da madrugada.',
  },
  {
    id: '2',
    name: 'Hugo Rocha',
    role: 'Sênior Backend',
    team: 'Esquadrão Code Builders',
    rarity: Rarity.RARE,
    attributes: { agility: 82, defense: 95, attack: 78 },
    achievements: ['SQL Ninja', 'API Sculptor'],
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hugo',
    bio: 'Fala fluentemente JSON e se alimenta de café gelado.',
  },
  ...Array.from({ length: 9 }).map((_, i) => ({
    id: (i + 3).toString(),
    name: ['Fabio Santos', 'Lucas M.', 'Bia Tech', 'John Coder', 'Dev Master', 'Code Ninja', 'Bug Slayer', 'Logic Guru', 'Kernel Hero'][i],
    role: ['DevOps Engineer', 'QA Lead', 'Frontend Dev', 'Backend Guru', 'Senior Architect', 'Junior Dev', 'Security Researcher', 'Cloud Architect', 'Database Hero'][i],
    team: 'Esquadrão Code Builders',
    rarity: i % 4 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: { 
      agility: 70 + Math.floor(Math.random() * 30), 
      defense: 60 + Math.floor(Math.random() * 40), 
      attack: 65 + Math.floor(Math.random() * 35) 
    },
    achievements: ['Bug Hunter', 'Refactoring Master'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=CB-${i+3}`,
    bio: 'Um especialista na arte de transformar café em código binário de alta performance.',
  })),

  // Page 2: Liga dos Guardiões (11 stickers)
  {
    id: '12',
    name: 'José Carlos',
    role: 'Founder & Guardian',
    team: 'Liga dos Guardiões',
    rarity: Rarity.RARE,
    attributes: { agility: 98, defense: 99, attack: 95 },
    achievements: ['Lifetime Achievement', 'Tech Visionary'],
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JoseCarlos',
    bio: 'O capitão e arquiteto de toda a jornada Fortes Tecnologia.',
  },
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: (i + 13).toString(),
    name: ['Carla Dias', 'Marcos Pires', 'Security G.', 'Wall B.', 'Net W.', 'Cyber S.', 'Guard T.', 'Shield P.', 'Sentinel X.', 'Vigilant M.'][i],
    role: ['Security Lead', 'Infra Specialist', 'Network Security', 'Firewall Admin', 'Security Analyst', 'Cloud Guardian', 'System Admin', 'Data Guard', 'Privacy Expert', 'Incident Responder'][i],
    team: 'Liga dos Guardiões',
    rarity: i % 4 === 3 ? Rarity.RARE : Rarity.COMMON,
    attributes: { 
      agility: 60 + Math.floor(Math.random() * 35), 
      defense: 80 + Math.floor(Math.random() * 20), 
      attack: 50 + Math.floor(Math.random() * 45) 
    },
    achievements: ['Uptime King', 'Shield Master'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=LG-${i}`,
    bio: 'O guardião silêncio que protege as fronteiras digitais da empresa contra qualquer ameaça.',
  })),

  // Page 3: Arquitetos de Experiência (11 stickers)
  ...Array.from({ length: 11 }).map((_, i) => ({
    id: (i + 23).toString(),
    name: ['Diego Lima', 'Julia Mendes', 'Pixel P.', 'Color Q.', 'Flow M.', 'User A.', 'Design H.', 'Sketch K.', 'Figma L.', 'Adobe S.', 'Art V.'][i],
    role: ['UX Designer', 'Product Designer', 'Interaction Lead', 'Visual Artist', 'Service Designer', 'User Researcher', 'Brand Designer', 'UI Guru', 'Motion Designer', 'Design Op', 'Experience Architect'][i],
    team: 'Arquitetos de Experiência',
    rarity: i === 0 ? Rarity.LEGENDARY : i % 4 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: { 
      agility: 65 + Math.floor(Math.random() * 30), 
      defense: 55 + Math.floor(Math.random() * 40), 
      attack: 85 + Math.floor(Math.random() * 15) 
    },
    achievements: ['Pixel Perfect', 'Experience Guru'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=AE-${i}`,
    bio: 'Transformando fluxos complexos em jornadas épicas e esteticamente perfeitas para nossos usuários.',
  })),

  // Page 4: Central de Inteligência (11 stickers)
  ...Array.from({ length: 11 }).map((_, i) => ({
    id: (i + 34).toString(),
    name: ['Beto Lima', 'Renata J.', 'Data L.', 'Matrix N.', 'Vector S.', 'Analytic P.', 'Query Q.', 'Model M.', 'Foreast F.', 'Cluster C.', 'Insight I.'][i],
    role: ['Data Scientist', 'BI Analyst', 'Data Engineer', 'AI Specialist', 'Machine Learning Op', 'Big Data Architect', 'Database Scientist', 'Statistician', 'Predictive Analyst', 'Insight Lead', 'Intelligence Officer'][i],
    team: 'Central de Inteligência',
    rarity: i === 0 ? Rarity.LEGENDARY : i % 4 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: { 
      agility: 75 + Math.floor(Math.random() * 20), 
      defense: 70 + Math.floor(Math.random() * 30), 
      attack: 80 + Math.floor(Math.random() * 20) 
    },
    achievements: ['Python Snake', 'Matrix Navigator'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=CI-${i}`,
    bio: 'Decifrando o futuro da empresa através das ondas de dados que fluem constantemente.',
  })),

  // Page 5: Suporte Tático (11 stickers)
  ...Array.from({ length: 11 }).map((_, i) => ({
    id: (i + 45).toString(),
    name: ['Léo Nunes', 'Gisele Melo', 'Support S.', 'Help H.', 'Zen Z.', 'Tactical T.', 'Client C.', 'User U.', 'Smile S.', 'Peace P.', 'Guide G.'][i],
    role: ['Customer Success', 'HR Director', 'Support Lead', 'Happiness Officer', 'Communication Specialist', 'Conflict Resolver', 'Talent Scout', 'Culture Builder', 'Crisis Manager', 'Engagement Op', 'Success Guide'][i],
    team: 'Suporte Tático',
    rarity: i === 0 ? Rarity.LEGENDARY : i % 4 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: { 
      agility: 90 + Math.floor(Math.random() * 10), 
      defense: 90 + Math.floor(Math.random() * 10), 
      attack: 55 + Math.floor(Math.random() * 35) 
    },
    achievements: ['Zen Master', 'First Responder'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=ST-${i}`,
    bio: 'A primeira linha de defesa e a ponte invisível que conecta nossa tecnologia ao sucesso humano.',
  })),

  // Page 6: Liderança Criativa (11 stickers)
  ...Array.from({ length: 11 }).map((_, i) => ({
    id: (i + 56).toString(),
    name: ['Roberto C.', 'Sandra V.', 'Elite E.', 'Vision V.', 'Chief C.', 'Lead L.', 'Head H.', 'Direct D.', 'Principle P.', 'Fellow F.', 'Legend L.'][i],
    role: ['CEO', 'CTO', 'Product VP', 'Tech Director', 'Creative Head', 'Lead Architect', 'Strategy VP', 'Operations Chief', 'Innovation Lead', 'Culture Fellow', 'Board Member'][i],
    team: 'Liderança Criativa',
    rarity: i % 5 === 0 ? Rarity.LEGENDARY : i % 3 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: {
      agility: 80 + Math.floor(Math.random() * 20),
      defense: 80 + Math.floor(Math.random() * 20),
      attack: 90 + Math.floor(Math.random() * 10)
    },
    achievements: ['Grand Visionary', 'Market Leader'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=LC-${i}`,
    bio: 'Guiando os rumos da nossa jornada tecnológica com sabedoria e audácia.',
  })),

  // Page 7: Comercial & Marketing (7 stickers — IDs 67-73)
  ...Array.from({ length: 7 }).map((_, i) => ({
    id: (i + 67).toString(),
    name: ['Felipe A.', 'Camila R.', 'Thiago B.', 'Larissa C.', 'Bruno M.', 'Priscila F.', 'Eduardo L.'][i],
    role: ['Sales Director', 'Marketing Lead', 'Account Manager', 'Growth Hacker', 'Brand Strategist', 'Content Lead', 'Business Dev'][i],
    team: 'Comercial & Marketing',
    rarity: i % 5 === 0 ? Rarity.LEGENDARY : i % 3 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: {
      agility: 85 + Math.floor(Math.random() * 15),
      defense: 70 + Math.floor(Math.random() * 25),
      attack: 88 + Math.floor(Math.random() * 12)
    },
    achievements: ['Top Seller', 'Brand Builder'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=CM-${i}`,
    bio: 'Conectando nossa tecnologia ao mercado e transformando clientes em parceiros estratégicos.',
  })),

  // Page 8: Produto & Inovação (7 stickers — IDs 74-80)
  ...Array.from({ length: 7 }).map((_, i) => ({
    id: (i + 74).toString(),
    name: ['Natalia S.', 'Rodrigo P.', 'Viviane M.', 'Gabriel T.', 'Isabela K.', 'Mateus H.', 'Fernanda O.'][i],
    role: ['Product Manager', 'Innovation Lead', 'Agile Coach', 'Product Owner', 'Strategy Analyst', 'OKR Specialist', 'Research Lead'][i],
    team: 'Produto & Inovação',
    rarity: i % 5 === 0 ? Rarity.LEGENDARY : i % 3 === 0 ? Rarity.RARE : Rarity.COMMON,
    attributes: {
      agility: 88 + Math.floor(Math.random() * 12),
      defense: 75 + Math.floor(Math.random() * 20),
      attack: 85 + Math.floor(Math.random() * 15)
    },
    achievements: ['Product Visionary', 'Agile Champion'],
    imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=PI-${i}`,
    bio: 'Descobrindo oportunidades invisíveis e transformando ideias em produtos que as pessoas amam.',
  })),
];

export const INITIAL_USER_STATS: UserStats = {
  stickersOwned: ['1', '2', '5', '8', '12', '15', '23', '25', '34', '45', '56', '57'], // Começa com algumas figurinhas de cada time
  duplicates: { '3': 2, '14': 1 },
  packetsOpened: 3,
  guessesRight: 1,
  guessesTotal: 1,
  lastGuessDate: null,
  lastPackDate: null,
};

export const RANKING_DATA = [
  { name: 'Ricardo Dev', score: 45, photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ricardo', isUser: false },
  { name: 'Mariana Design', score: 38, photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mari', isUser: false },
  { name: 'Gustavo Infra', score: 32, photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gus', isUser: false },
  { name: 'Ana Product', score: 28, photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AnaP', isUser: false },
  { name: 'Juliana BI', score: 15, photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juli', isUser: false },
];
