// Gera o exemplo PDF sem navegador nem automação GUI.
import { createCanvas } from '@napi-rs/canvas';
import { jsPDF } from 'jspdf';
import { writeFileSync } from 'node:fs';
import { fichaExemplo } from '../src/exemplo.js';
import { gerarPdf } from '../src/pdf.js';
const f = fichaExemplo();
const doc = gerarPdf(f, {jsPDF, criarCanvas: () => createCanvas(1100,470)});
writeFileSync('exemplo-ficha.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('PDF gerado sem navegador.');
