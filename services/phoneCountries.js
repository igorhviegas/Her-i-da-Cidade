// Países e códigos de discagem (DDI) do formulário de agendamento. Puro: sem React/Firebase.
// Só o par país → DDI fica aqui; o nome vem do Intl.DisplayNames e a bandeira, do próprio código ISO.
// Países do plano norte-americano (+1) usam "1": o código de área faz parte do número digitado.

export const DEFAULT_PHONE_COUNTRY = 'BR';

const CODES = 'AF:93,AL:355,DZ:213,AD:376,AO:244,AR:54,AM:374,AW:297,AU:61,AT:43,AZ:994,BS:1,BH:973,BD:880,BB:1,BY:375,BE:32,BZ:501,BJ:229,BT:975,BO:591,BA:387,BW:267,BR:55,BN:673,BG:359,BF:226,BI:257,KH:855,CM:237,CA:1,CV:238,CF:236,TD:235,CL:56,CN:86,CO:57,KM:269,CG:242,CD:243,CR:506,CI:225,HR:385,CU:53,CW:599,CY:357,CZ:420,DK:45,DJ:253,DO:1,EC:593,EG:20,SV:503,GQ:240,ER:291,EE:372,SZ:268,ET:251,FJ:679,FI:358,FR:33,GF:594,PF:689,GA:241,GM:220,GE:995,DE:49,GH:233,GI:350,GR:30,GL:299,GP:590,GT:502,GN:224,GW:245,GY:592,HT:509,HN:504,HK:852,HU:36,IS:354,IN:91,ID:62,IR:98,IQ:964,IE:353,IL:972,IT:39,JM:1,JP:81,JO:962,KZ:7,KE:254,KW:965,KG:996,LA:856,LV:371,LB:961,LS:266,LR:231,LY:218,LI:423,LT:370,LU:352,MO:853,MG:261,MW:265,MY:60,MV:960,ML:223,MT:356,MQ:596,MR:222,MU:230,MX:52,MD:373,MC:377,MN:976,ME:382,MA:212,MZ:258,MM:95,NA:264,NP:977,NL:31,NC:687,NZ:64,NI:505,NE:227,NG:234,MK:389,NO:47,OM:968,PK:92,PS:970,PA:507,PG:675,PY:595,PE:51,PH:63,PL:48,PT:351,PR:1,QA:974,RE:262,RO:40,RU:7,RW:250,SM:378,ST:239,SA:966,SN:221,RS:381,SC:248,SL:232,SG:65,SK:421,SI:386,SO:252,ZA:27,KR:82,SS:211,ES:34,LK:94,SD:249,SR:597,SE:46,CH:41,SY:963,TW:886,TJ:992,TZ:255,TH:66,TL:670,TG:228,TT:1,TN:216,TR:90,TM:993,UG:256,UA:380,AE:971,GB:44,US:1,UY:598,UZ:998,VE:58,VN:84,YE:967,ZM:260,ZW:263,XK:383';

/** [{ iso: 'BR', ddi: '55' }, …] na ordem do cadastro. */
export const PHONE_COUNTRIES = CODES.split(',').map((entry) => { const [iso, ddi] = entry.split(':'); return { iso, ddi }; });

const byIso = new Map(PHONE_COUNTRIES.map((country) => [country.iso, country]));

/** DDI (só dígitos) do país; país desconhecido cai no Brasil. */
export const ddiOf = (iso) => (byIso.get(iso) ?? byIso.get(DEFAULT_PHONE_COUNTRY)).ddi;

/** Bandeira em emoji a partir do código ISO (dois indicadores regionais). */
export const flagEmoji = (iso) => String.fromCodePoint(...[...iso].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));

/** Opções do seletor: Brasil primeiro (padrão), depois os demais por nome no idioma pedido. */
export function phoneCountryOptions(locale = 'pt-BR') {
  let names = null;
  try { names = new Intl.DisplayNames([locale], { type: 'region' }); } catch { /* ambiente sem DisplayNames: mostra o código ISO */ }
  const options = PHONE_COUNTRIES.map(({ iso, ddi }) => {
    let name = iso;
    try { name = names?.of(iso) ?? iso; } catch { /* código que o ambiente não conhece */ }
    return { iso, ddi, name, flag: flagEmoji(iso), label: `${flagEmoji(iso)} +${ddi} ${name}` };
  });
  const rest = options.filter((option) => option.iso !== DEFAULT_PHONE_COUNTRY).sort((a, b) => a.name.localeCompare(b.name, locale));
  return [options.find((option) => option.iso === DEFAULT_PHONE_COUNTRY), ...rest];
}
