import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const INITIAL_SERVICES = [
  {
    id: '1',
    title: 'Vídeo Especial de Aniversário',
    price: 'Apenas R$ 30',
    description: 'Uma mensagem do herói da cidade para o aniversariante do dia.',
    imageUrl: 'https://strict-bronze-c9lmqpt5fv.edgeone.app/Anivers%C3%A1rio.jpeg',
    category: 'Pronta entrega',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Especial%20de%20Anivers%C3%A1rio',
    active: true,
    order: 1
  },
  {
    id: '2',
    title: 'Vídeo Chamada ao Vivo',
    price: '15 minutos R$ 75',
    description: 'Interação em tempo real com o herói, direto da nossa base secreta.',
    imageUrl: 'https://eerie-chocolate-cuzaxle2lt.edgeone.app/Chamada.jpeg',
    category: 'Ao Vivo',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Chamada%20ao%20Vivo',
    active: true,
    order: 2
  },
  {
    id: '3',
    title: 'Vídeo Personalizado',
    price: 'A partir de R$ 60',
    description: 'Roteiro exclusivo para situações especiais: bom comportamento, escola, etc.',
    imageUrl: 'https://young-blush-amffe0wipw.edgeone.app/Personalizado.jpeg',
    category: 'Exclusivo',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Personalizado',
    active: true,
    order: 3
  },
  {
    id: '4',
    title: 'Vídeo Convite',
    price: 'A partir de R$ 65',
    description: 'Convite animado e épico para sua festa de aniversário temática.',
    imageUrl: 'https://wooden-chocolate-e7hrhsuhzk.edgeone.app/Convite.jpeg',
    category: 'Exclusivo',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Convite',
    active: true,
    order: 4
  },
  {
    id: '5',
    title: 'Vídeo Temático',
    price: 'Apenas R$ 20',
    description: 'Coloque o nome da sua criança nos vídeos do instagram.',
    imageUrl: 'https://sunny-amethyst-y7zbexuydq.edgeone.app/Tem%C3%A1tico.jpeg',
    category: 'Pronta Entrega',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Tem%C3%A1tico',
    active: true,
    order: 5
  },
  {
    id: '6',
    title: 'Serviços Presenciais',
    price: 'Sob Consulta',
    description: 'Visitas reais em festas e eventos corporativos na sua cidade.',
    imageUrl: 'https://grateful-bronze-9xbpmjgfbs.edgeone.app/Presencial.jpeg',
    category: 'Presencial',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20Servi%C3%A7os%20Presenciais',
    active: true,
    order: 6
  }
];

/**
 * Popula/Sincroniza os serviços na coleção 'services' do Firestore de forma segura e idempotente.
 * @param {admin.firestore.Firestore} db Instância do Firestore Admin
 * @param {boolean} isDryRun Se true, apenas simula sem gravar
 */
export async function seedServices(db, isDryRun = false) {
  console.log('\n--- Sincronização da Coleção de Serviços (services) ---');
  const results = {
    created: 0,
    existing: 0,
    errors: 0
  };

  const servicesCollection = db.collection('services');

  for (const serviceData of INITIAL_SERVICES) {
    const docRef = servicesCollection.doc(serviceData.id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      results.existing++;
      console.log(`  [OK] services/${serviceData.id} ('${serviceData.title}') já existe no Firestore. Dados preservados.`);
    } else {
      results.created++;
      if (isDryRun) {
        console.log(`  [CREATE - DRY RUN] services/${serviceData.id} ('${serviceData.title}') seria criado.`);
      } else {
        const payload = {
          id: serviceData.id,
          title: serviceData.title,
          price: serviceData.price,
          description: serviceData.description,
          imageUrl: serviceData.imageUrl,
          category: serviceData.category,
          whatsappUrl: serviceData.whatsappUrl,
          active: serviceData.active,
          order: serviceData.order,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await docRef.set(payload);
        console.log(`  [CREATED] services/${serviceData.id} ('${serviceData.title}') criado com sucesso!`);
      }
    }
  }

  return results;
}

// Permite execução autônoma via 'npm run firebase:seed'
if (process.argv[1] && process.argv[1].endsWith('seed-services.mjs')) {
  const isDryRun = process.argv.includes('--dry-run');

  // Inicializa credenciais do Admin SDK se executado de forma independente
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath || !fs.existsSync(credPath)) {
    console.error('\n[ERRO DE CREDENCIAIS] GOOGLE_APPLICATION_CREDENTIALS não foi configurada ou o arquivo não foi encontrado.');
    console.error('Por favor, configure no PowerShell com:');
    console.error('  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\caminho\\sua-service-account.json"');
    process.exit(1);
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }

  const db = admin.firestore();

  seedServices(db, isDryRun)
    .then((res) => {
      console.log(`\nSincronização concluída! Criados: ${res.created}, Existentes: ${res.existing}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nErro ao popular serviços:', err);
      process.exit(1);
    });
}
