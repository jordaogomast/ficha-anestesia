import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analisar} from '../src/parser.js';
import {novaFicha, aplicarItem, filtrarIdentificacaoManual, pendencias} from '../src/ficha.js';
test('identificadores ditados são bloqueados com explicação; clínica preservada e plano manual',()=>{
 const r=filtrarIdentificacaoManual(analisar('paciente João da Silva peso 70 quilos operadora Unimed').itens);
 assert.match(r.aviso,/preencher à mão/);assert.ok(!r.itens.some(i=>i.dados.campo==='nome'));
 assert.ok(r.itens.some(i=>i.dados.campo==='pesoKg'));assert.ok(!r.itens.some(i=>i.dados.campo==='operadora'));
});
test('campos antigos de identificação mantidos intactos, novos valores não aplicados',()=>{
 const f=novaFicha();f.paciente.nome='Registro legado';f.paciente.dataNascimento='1980-01-01';
 for(const it of analisar('paciente Outro Nome nascimento 05/11/1975 sexo masculino').itens)aplicarItem(f,it);
 assert.equal(f.paciente.nome,'Registro legado');assert.equal(f.paciente.dataNascimento,'1980-01-01');assert.equal(f.paciente.sexo,null);
});
test('salvar não exige nome, nascimento, idade ou sexo',()=>{
 const p=pendencias(novaFicha());assert.ok(!p.some(x=>/nome do paciente|nascimento|idade|sexo/i.test(x)));
});
test('UI não oferece identificação por teclado; PDF não usa identidade no conteúdo ou nome do arquivo',()=>{
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.ok(!app.includes("['paciente.nome',"));assert.ok(!app.includes("['paciente.dataNascimento',"));assert.ok(!app.includes("['paciente.sexo',"));
 const pdf=readFileSync(new URL('../src/pdf.js',import.meta.url),'utf8');
 assert.ok(!pdf.includes('p.nome'));assert.ok(!pdf.includes('p.dataNascimento'));assert.ok(!pdf.includes('p.sexo'));assert.ok(!pdf.includes('f.paciente.nome'));
 assert.match(pdf,/Nome completo:/);assert.match(pdf,/Prontuário/);
});

import {createCanvas} from '@napi-rs/canvas';
import {jsPDF} from 'jspdf';
import {gerarPdf,nomeArquivoPdf} from '../src/pdf.js';
import {fichaExemplo} from '../src/exemplo.js';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('hospital, documentos e plano bloqueados sem apagar legado; sem exigência para salvar',()=>{
 const f=novaFicha();f.procedimento.hospital='LEGADO';f.paciente.plano.operadora='LEGADO_PLANO';
 for(const t of ['hospital Novo Hospital','CPF 12345678900','prontuário 123','atendimento 123','leito 4','operadora Novo Plano','carteirinha 123','guia 123','senha de autorização 123','etiqueta ABC','código de barras 123']){
  const raw=analisar(t).itens;assert.ok(raw.length,t);const filtered=filtrarIdentificacaoManual(raw);assert.equal(filtered.itens.length,0,t);assert.match(filtered.aviso,/preencher à mão/);raw.forEach(i=>aplicarItem(f,i));
 }
 assert.equal(f.procedimento.hospital,'LEGADO');assert.equal(f.paciente.plano.operadora,'LEGADO_PLANO');
 assert.ok(!pendencias(f).some(x=>/operadora|carteirinha|guia|hospital/i.test(x)));
});
test('PDF real omite TODOS os valores identificadores legados e deixa campos administrativos em branco',()=>{
 const f=fichaExemplo();const sentinelas=['PESSOA_SENTINELA','HOSPITAL_SENTINELA','PLANO_SENTINELA','CPF_SENTINELA','GUIA_SENTINELA','CARTEIRA_SENTINELA','SENHA_SENTINELA','ATENDIMENTO_SENTINELA','LEITO_SENTINELA','ANS_SENTINELA','PRONTUARIO_SENTINELA'];
 Object.assign(f.paciente,{nome:sentinelas[0],dataNascimento:'1901-02-03',sexo:'F',cpf:sentinelas[3],atendimento:sentinelas[7],leito:sentinelas[8],prontuario:sentinelas[10]});
 f.procedimento.hospital=sentinelas[1];Object.assign(f.paciente.plano,{operadora:sentinelas[2],numeroGuia:sentinelas[4],carteirinha:sentinelas[5],senhaAutorizacao:sentinelas[6],registroAns:sentinelas[9]});
 const dir=mkdtempSync(join(tmpdir(),'ficha-pdf-'));try{
  const pdf=gerarPdf(f,{jsPDF,criarCanvas:()=>createCanvas(1100,470)});const path=join(dir,'ficha.pdf');writeFileSync(path,Buffer.from(pdf.output('arraybuffer')));
  const text=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});
  for(const v of sentinelas){assert.ok(!text.includes(v),v);assert.ok(!nomeArquivoPdf(f).includes(v));}
  assert.ok(!text.includes('1901'));for(const l of ['Hospital / estabelecimento','Nome completo','Nascimento','CPF / RG','Prontuário','Atendimento','Leito','Operadora','Carteirinha','Guia','autorização','etiqueta','ANOTAÇÕES EXTRAS'])assert.ok(text.includes(l),l);
  assert.equal(f.procedimento.hospital,sentinelas[1]);assert.equal(f.paciente.nome,sentinelas[0]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
