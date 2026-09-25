import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const INITIAL_SEO = {
  seoTitle: 'Homem-Aranha Personagem Vivo em BH | Herói da Cidade',
  seoDescription: 'Contrate o Homem-Aranha para festas infantis, aniversários e eventos em Belo Horizonte, Betim, Contagem, Nova Lima e região.',
};

const INITIAL_SECTIONS = [
  { id: 'home-hero', internalName: 'Hero', sectionType: 'hero', title: 'O Herói\nDa Cidade', subtitle: '', description: 'Criando memórias\nQue nunca serão esquecidas', active: true, order: 0 },
  { id: 'home-services', internalName: 'Serviços', sectionType: 'services', title: 'Escolha Sua\nPróxima Missão', subtitle: 'Nossos serviços', description: 'Cada vídeo é feito com qualidade e o carinho de uma equipe que ama o que faz, para que a magia seja transformada em boas memórias.', active: true, order: 1 },
  { id: 'home-video-teaser', internalName: 'Vídeos', sectionType: 'video-teaser', title: 'Encontre o vídeo certo para cada momento.', subtitle: 'Plataforma de vídeos', description: 'O Herói da Cidade disponibiliza uma plataforma exclusiva onde pais e educadores encontram vídeos por temas específicos para orientar, divertir e inspirar as crianças.', buttonText: 'Acessar catálogo completo', active: true, order: 2 },
  { id: 'home-about', internalName: 'Sobre nós', sectionType: 'about', title: 'Criando Memórias\nQue Nunca Serão Esquecidas', subtitle: 'Sobre nós', description: 'O Herói da Cidade nasceu do sonho de um menino apaixonado pelo "Amigão da Vizinhança", de se tornar um super heroi desde pequeno. Como a principal função de um herói é ajudar as pesssoas, Igor Viegas (nosso Homem-Aranha) descobriu uma maneira divertida de fazer isso. Com os vídeos educativos, conquistou milhares de seguidores e ajudou diversas famílias com as tarefas mais difíceis do desenvolvimento infanti. Somos especializados em entretenimento lúdico e educacional de alta qualidade exclusivamente com o Homem-Aranha.\n\nFora das telinhas, o heroi da Cidade atua em festas infantis com o personagem Homem-Aranha em toda região metropolitana de Belo Horizonte em minas Gerais, incluindo Betim, Contagem, Nova Lima, Lagoa Santa, Igarapé, Ribeirão das neves e muito mais. Fazemos com que até os mais velhos se questionem se o Homem-Aranha realmente existe; Incorporamos os valores, a voz e a presença do herói mais querido. Nosso compromisso é com a emoção genuína e a criação de memórias que duram a vida toda.', imageUrl: 'https://disciplinary-peach-obfj8i7gqu.edgeone.app/profissional%201.jpeg', buttonText: 'Fale com nossa equipe', active: true, order: 3 },
  { id: 'home-booking', internalName: 'Agendamento', sectionType: 'booking', title: 'Agende Sua\nChamada de Vídeo', subtitle: 'Base de Operações Online', description: 'Escolha um horário abaixo para uma experiência imersiva com o Herói da Cidade.\nNossa base secreta está pronta para a conexão!', active: true, order: 4 },
  { id: 'home-testimonials', internalName: 'Depoimentos', sectionType: 'testimonials', title: 'Depoimentos', subtitle: '', description: '', active: true, order: 5 },
];

async function run() {
  let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    const candidates = [
      path.join(rootDir, 'firebase-service-account.json'),
      path.join(rootDir, 'credentials', 'firebase-service-account.json'),
      path.join(rootDir, '.firebase', 'heroi-da-cidade-service-account.json'),
    ];
    credPath = candidates.find((candidate) => fs.existsSync(candidate));
  }
  if (!credPath || !fs.existsSync(credPath)) throw new Error('Service Account não encontrada para execução do seed.');

  const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }

  const db = admin.firestore();
  const homeRef = db.collection('siteContent').doc('home');
  const homeSnapshot = await homeRef.get();
  if (homeSnapshot.exists) {
    console.log('siteContent/home já existe. Nenhum dado foi alterado.');
    return;
  }

  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(homeRef, { ...INITIAL_SEO, contentInitialized: true, createdAt: timestamp, updatedAt: timestamp });
  for (const { id, ...section } of INITIAL_SECTIONS) {
    batch.set(homeRef.collection('sections').doc(id), { ...section, startAt: null, endAt: null, createdAt: timestamp, updatedAt: timestamp });
  }
  await batch.commit();
  console.log('Conteúdo inicial da home criado sem sobrescrever dados.');
}

run().catch((error) => {
  console.error('Erro ao inicializar o conteúdo da home:', error);
  process.exitCode = 1;
});
