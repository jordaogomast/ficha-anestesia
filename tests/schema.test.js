import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fichaExemplo } from '../src/exemplo.js';
import { novaFicha, pendencias, apagarUltimaFrase, adicionarFraseAnotacao } from '../src/ficha.js';

const schema = JSON.parse(readFileSync(new URL('../schema/ficha-anestesia.schema.json', import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const validar = ajv.compile(schema);

test('ficha de exemplo é válida no JSON Schema', () => { const ok = validar(fichaExemplo()); assert.ok(ok, JSON.stringify(validar.errors, null, 1)); });
test('ficha de exemplo sem pendências de faturamento', () => assert.deepEqual(pendencias(fichaExemplo()), []));
test('ficha nova lista pendências', () => assert.ok(pendencias(novaFicha()).length >= 10));
test('anotações extras: acrescentar e apagar última frase', () => {
  const f = novaFicha();
  adicionarFraseAnotacao(f, 'primeira frase', null); adicionarFraseAnotacao(f, 'segunda frase', null);
  assert.equal(f.anotacoesExtras.texto, 'Primeira frase. Segunda frase');
  apagarUltimaFrase(f); assert.equal(f.anotacoesExtras.texto, 'Primeira frase.'); assert.equal(f.anotacoesExtras.frases.length, 1);
  apagarUltimaFrase(f); assert.equal(f.anotacoesExtras.texto, '');
});
