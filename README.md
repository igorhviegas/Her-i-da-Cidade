<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Herói da Cidade

Aplicação web desenvolvida com React, Vite, TypeScript, Tailwind/Vanilla CSS e Firebase (Authentication e Cloud Firestore).

---

## Execução Local

**Pré-requisitos:** Node.js (v18+) e npm.

1. Instalar as dependências:
   ```bash
   npm install
   ```
2. Configurar o arquivo `.env` a partir do [.env.example](.env.example):
   ```bash
   cp .env.example .env
   ```
3. Iniciar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## Configuração Firebase

O projeto utiliza **Firebase Authentication** e **Cloud Firestore**. Para inicializar ou popular o ambiente Firebase existente sem precisar criar documentos manualmente pelo Firebase Console, utilize a automação via scripts locais seguros e idempotentes.

### 1. Instalar o Firebase CLI e Fazer Login

Caso ainda não possua o Firebase CLI instalado globalmente:

```bash
npm install -g firebase-tools
```

Em seguida, faça o login na sua conta do Google associada ao projeto Firebase:

```bash
firebase login
```

Para listar e selecionar o projeto correto:

```bash
firebase projects:list
firebase use <seu-project-id>
```

### 2. Obter a Service Account (Chave Administrativa)

1. Acesse o **Firebase Console**: [https://console.firebase.google.com](https://console.firebase.google.com)
2. Selecione o projeto **Herói da Cidade**.
3. Clique no ícone de engrenagem ⚙️ > **Configurações do projeto** (Project Settings).
4. Acesse a aba **Contas de serviço** (Service accounts).
5. Clique em **Gerar nova chave privada** (Generate new private key).
6. Salve o arquivo JSON retornado em um local seguro em sua máquina local.

> [!WARNING]
> **SEGURANÇA**: NUNCA envie ou comite a Service Account JSON no repositório GitHub. O arquivo já está configurado no `.gitignore` e não deve ser compartilhado.

Recomendamos salvar o arquivo no caminho do seu sistema ou na pasta `credentials/` na raiz do projeto (que já é ignorada pelo Git):
`C:\caminho\firebase-service-account.json` ou `credentials/firebase-service-account.json`.

### 3. Configurar Variáveis de Ambiente Locais

#### Windows (PowerShell)
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\firebase-service-account.json"
$env:FIREBASE_ADMIN_EMAIL="igorhviegas@gmail.com"
```

#### Windows (CMD)
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\firebase-service-account.json
set FIREBASE_ADMIN_EMAIL=igorhviegas@gmail.com
```

#### Linux / macOS / Bash
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/caminho/firebase-service-account.json"
export FIREBASE_ADMIN_EMAIL="igorhviegas@gmail.com"
```

### 4. Executar o Setup do Firebase

Para realizar o deploy automático das Security Rules ([`firestore.rules`](firestore.rules)), vincular o usuário administrador inicial em `admins/{UID}` e popular os 6 serviços iniciais na coleção `services`:

```bash
npm run firebase:setup
```

#### Modo de Simulação (Dry Run)
Para verificar exatamente quais ações seriam realizadas **sem alterar o Firestore** nem publicar regras:

```bash
npm run firebase:setup -- --dry-run
```

Exemplo de saída no terminal:
```text
====================================================
  FIREBASE ENVIRONMENT SETUP [MODO DRY RUN]
====================================================

✓ Project ID identificado com segurança: [heroi-da-cidade]
✓ Credencial utilizada: C:\caminho\firebase-service-account.json

--- 1. Publicação de Segurança (Firestore Rules) ---
  [DRY RUN] O deploy do arquivo 'firestore.rules' seria executado para o projeto 'heroi-da-cidade'.

--- 2. Configuração do Administrador Inicial ---
  Buscando usuário administrador no Firebase Auth com e-mail: 'igorhviegas@gmail.com'...
  ✓ Usuário localizado no Auth! UID: xxxxxxxx
  [OK] Documento 'admins/xxxxxxxx' já existe no Firestore. Dados preservados.

--- Sincronização da Coleção de Serviços (services) ---
  [OK] services/1 ('Vídeo Especial de Aniversário') já existe no Firestore. Dados preservados.
  [CREATE - DRY RUN] services/2 ('Vídeo Chamada ao Vivo') seria criado.
  ...
====================================================
```

#### Popular Apenas os Serviços
Se desejar executar apenas a sincronização/população da coleção `services`:

```bash
npm run firebase:seed
```

### 5. Verificar o Resultado no Firebase Console

Após a execução com sucesso de `npm run firebase:setup`:
1. **Firestore Database**:
   - Coleção `admins`: Deve existir o documento com a chave do UID do seu usuário Auth (ex: `admins/{UID}`) contendo `email`, `role: "superadmin"`, `active: true`.
   - Coleção `services`: Devem existir os 6 documentos com IDs `1`, `2`, `3`, `4`, `5`, `6` preservando os dados dos serviços.
2. **Regras de Segurança (Firestore Rules)**:
   - Verifique se as regras no Firebase Console estão sincronizadas com o arquivo [`firestore.rules`](firestore.rules).
