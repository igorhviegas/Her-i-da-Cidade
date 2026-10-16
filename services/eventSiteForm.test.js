import test from 'node:test';
import assert from 'node:assert/strict';
import { addonsTotal, childrenNames, fullLocation, isValidCpf, observationLines, validateSiteForm, whatsappDoneMessage } from './eventSiteForm.js';

const valid = {
  packageId: 'aniversario', childName: ' Miguel Heitor ', childAge: '5 anos', pcd: 'no', eventDate: '2026-11-22', eventTime: '14:00',
  location: 'Rua 3, nº 60, Vila Alpina, Betim/MG', reference: '', responsibleName: 'Kemily Caires', cpf: '529.982.247-25',
  ddi: '55', whatsapp: '(31) 99999-0001', email: 'K@Example.com', extraWeb: 1, birthdayVideo: true, birthdayName: 'Miguel',
  inviteVideo: false, imageAuthorization: 'yes', acceptTerms: true,
};

test('CPF: dígitos verificadores', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224726'), false);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('123'), false);
});

test('envio válido sai limpo', () => {
  const { form, errors } = validateSiteForm(valid, { today: '2026-10-16' });
  assert.equal(errors, undefined);
  assert.equal(form.childName, 'Miguel Heitor');
  assert.equal(form.cpf, '52998224725');
  assert.equal(form.email, 'k@example.com');
  assert.equal(form.pcd, false);
  assert.equal(form.imageAuthorization, true);
  assert.equal(addonsTotal(form), 15 + 20);
});

test('obrigatórios e regras', () => {
  const { errors } = validateSiteForm({ ...valid, cpf: '111', eventDate: '2026-10-01', acceptTerms: false, imageAuthorization: '' }, { today: '2026-10-16' });
  assert.deepEqual(errors, ['A data do evento já passou.', 'Informe um CPF válido.', 'Responda se autoriza o uso de imagens.', 'Para concluir, leia e aceite os termos de contratação.']);
  assert.match(validateSiteForm({ ...valid, packageId: 'vip', childName: '' }, { today: '2026-10-16' }).errors[0], /evento ou da empresa/);
  assert.match(validateSiteForm({ ...valid, birthdayName: '' }, { today: '2026-10-16' }).errors[0], /primeiro nome/);
});

test('observações e endereço para o CRM', () => {
  const { form } = validateSiteForm({ ...valid, reference: 'Salão Azul', pcd: 'yes', pcdDetails: 'autismo leve' }, { today: '2026-10-16' });
  assert.equal(fullLocation(form), 'Rua 3, nº 60, Vila Alpina, Betim/MG (ref.: Salão Azul)');
  assert.deepEqual(observationLines(form), ['Idade: 5 anos', 'PCD/PNE: autismo leve', 'Vídeo Especial de Aniversário: Miguel (+R$ 20)']);
});

test('mensagem do WhatsApp com o número do formulário', () => {
  assert.equal(
    whatsappDoneMessage({ number: 214, packageId: 'aniversario', eventDate: '2026-11-22', eventTime: '14:00', childName: 'Miguel' }),
    'Olá! Preenchi o formulário A214 (Aniversário Espetacular de Miguel, 22/11/2026 às 14:00). Aguardo os dados para o pagamento do sinal de 50% da reserva.',
  );
});

test('irmãos e vídeo convite', () => {
  const ok = validateSiteForm({ ...valid, extraChildren: [{ name: ' Ana ', age: '3' }], inviteVideo: true, inviteParents: 'Kemily e João', inviteGuestTime: '15:00' }, { today: '2026-10-16' });
  assert.equal(ok.form.extraChildren[0].name, 'Ana');
  assert.equal(childrenNames(ok.form), 'Miguel Heitor e Ana');
  assert.equal(childrenNames({ childName: 'A', extraChildren: [{ name: 'B' }, { name: 'C' }] }), 'A, B e C');
  assert.equal(addonsTotal(ok.form), 15 + 20 + 45 + 10);
  assert.match(observationLines(ok.form).join('|'), /Irmãos: Ana \(3\) · certificado individual \(\+R\$ 10 cada\)/);
  assert.match(observationLines(ok.form).join('|'), /pais Kemily e João; horário para os convidados 15:00/);
  const bad = validateSiteForm({ ...valid, extraChildren: [{ name: '' }], inviteVideo: true }, { today: '2026-10-16' });
  assert.deepEqual(bad.fields, ['extraChildren', 'inviteParents', 'inviteGuestTime']);
});
