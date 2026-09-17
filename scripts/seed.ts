import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, terminate } from "firebase/firestore";
import config from "../firebase-applet-config.json";

const app = initializeApp(config);
const db = getFirestore(app);

const SERVICES_DATA = [
  {
    id: "1",
    title: "Vídeo Especial de Aniversário",
    name: "Vídeo Especial de Aniversário",
    price: "Apenas R$ 30",
    description: "Uma mensagem do herói da cidade para o aniversariante do dia.",
    imageUrl: "https://strict-bronze-c9lmqpt5fv.edgeone.app/Anivers%C3%A1rio.jpeg",
    image: "https://strict-bronze-c9lmqpt5fv.edgeone.app/Anivers%C3%A1rio.jpeg",
    category: "Pronta entrega",
    active: true,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2",
    title: "Vídeo Chamada ao Vivo",
    name: "Vídeo Chamada ao Vivo",
    price: "15 minutos R$ 75",
    description: "Interação em tempo real com o herói, direto da nossa base secreta.",
    imageUrl: "https://eerie-chocolate-cuzaxle2lt.edgeone.app/Chamada.jpeg",
    image: "https://eerie-chocolate-cuzaxle2lt.edgeone.app/Chamada.jpeg",
    category: "Ao Vivo",
    active: true,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    title: "Vídeo Personalizado",
    name: "Vídeo Personalizado",
    price: "A partir de R$ 60",
    description: "Roteiro exclusivo para situações especiais: bom comportamento, escola, etc.",
    imageUrl: "https://young-blush-amffe0wipw.edgeone.app/Personalizado.jpeg",
    image: "https://young-blush-amffe0wipw.edgeone.app/Personalizado.jpeg",
    category: "Exclusivo",
    active: true,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "4",
    title: "Vídeo Convite",
    name: "Vídeo Convite",
    price: "A partir de R$ 65",
    description: "Convite animado e épico para sua festa de aniversário temática.",
    imageUrl: "https://wooden-chocolate-e7hrhsuhzk.edgeone.app/Convite.jpeg",
    image: "https://wooden-chocolate-e7hrhsuhzk.edgeone.app/Convite.jpeg",
    category: "Exclusivo",
    active: true,
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "5",
    title: "Vídeo Temático",
    name: "Vídeo Temático",
    price: "Apenas R$ 20",
    description: "Coloque o nome da sua criança nos vídeos do instagram.",
    imageUrl: "https://sunny-amethyst-y7zbexuydq.edgeone.app/Tem%C3%A1tico.jpeg",
    image: "https://sunny-amethyst-y7zbexuydq.edgeone.app/Tem%C3%A1tico.jpeg",
    category: "Pronta Entrega",
    active: true,
    order: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "6",
    title: "Serviços Presenciais",
    name: "Serviços Presenciais",
    price: "Sob Consulta",
    description: "Visitas reais em festas e eventos corporativos na sua cidade.",
    imageUrl: "https://grateful-bronze-9xbpmjgfbs.edgeone.app/Presencial.jpeg",
    image: "https://grateful-bronze-9xbpmjgfbs.edgeone.app/Presencial.jpeg",
    category: "Presencial",
    active: true,
    order: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const ADMIN_DATA = {
  uid: "default_superadmin",
  email: "igorhviegas@gmail.com",
  role: "superadmin",
  active: true,
  displayName: "Igor Viegas",
  createdAt: new Date().toISOString()
};

async function seed() {
  console.log("Iniciando povoamento do Cloud Firestore...");

  // 1. Inserir serviços
  for (const s of SERVICES_DATA) {
    const docRef = doc(db, "services", s.id);
    await setDoc(docRef, s, { merge: true });
    console.log(`Serviço [${s.id}] '${s.title}' gravado com sucesso!`);
  }

  // 2. Inserir admin inicial
  const adminRef = doc(db, "admins", "default_superadmin");
  await setDoc(adminRef, ADMIN_DATA, { merge: true });
  console.log("Documento de administrador em 'admins/default_superadmin' gravado com sucesso!");

  // Também grava com o alias igorhviegas para facilidade de busca
  const adminEmailRef = doc(db, "admins", "igorhviegas");
  await setDoc(adminEmailRef, { ...ADMIN_DATA, uid: "igorhviegas" }, { merge: true });
  console.log("Documento de administrador em 'admins/igorhviegas' gravado com sucesso!");

  await terminate(db);
  console.log("Povoamento do Firestore concluído com êxito total!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Erro ao povoar o Firestore:", err);
  process.exit(1);
});
