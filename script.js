const c1 = document.getElementById('c1'), c2 = document.getElementById('c2'), res = document.getElementById('res');
const range = document.getElementById('rangeC'), val = document.getElementById('valC');
let chart1, chartB, chartRes;

range.oninput = () => val.innerText = range.value;
const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

function initChart(id) {
    return new Chart(document.getElementById(id), {
        type: 'bar',
        data: {
            labels: Array.from({ length: 256 }, (_, i) => i),
            datasets: [{ label: 'Pixels', data: [], backgroundColor: '#00adb5', barPercentage: 1.0, categoryPercentage: 1.0 }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: { display: true, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 10 } },
                y: { display: true, ticks: { color: '#666', font: { size: 9 } } }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

chart1 = initChart('h1'); chartB = initChart('hB'); chartRes = initChart('hRes');

function updateHist(canvas, chart) {
    if (!canvas.width) return;
    const data = canvas.getContext('2d').getImageData(0, 0, 300, 300).data;
    let hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        let gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
        hist[gray]++;
    }
    chart.data.datasets[0].data = hist;
    chart.update();
}

function loadFile(file, canvas, chartObj) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
        canvas.width = 300; canvas.height = 300;
        canvas.getContext('2d').drawImage(img, 0, 0, 300, 300);
        updateHist(canvas, chartObj);
    };
    img.src = URL.createObjectURL(file);
}

document.getElementById('upload1').onchange = e => loadFile(e.target.files[0], c1, chart1);
document.getElementById('upload2').onchange = e => loadFile(e.target.files[0], c2, chartB);

function executar(tipo) {
    if (c1.width === 0) return alert("Suba a imagem A");
    const ctx1 = c1.getContext('2d'), p1 = ctx1.getImageData(0, 0, 300, 300).data;
    const ctxR = res.getContext('2d'); res.width = 300; res.height = 300;
    let out = ctxR.createImageData(300, 300), pr = out.data, C = Number(range.value);

    let p2 = null;
    if (['soma', 'sub', 'dif', 'media', 'blend', 'and', 'or', 'xor'].includes(tipo)) {
        if (c2.width === 0) return alert("Suba a imagem B");
        p2 = c2.getContext('2d').getImageData(0, 0, 300, 300).data;
    }

    if (tipo.startsWith('f')) {
        aplicarFiltro(p1, pr, tipo);
    } else if (tipo === 'flipH' || tipo === 'flipV') {
        ctxR.save();
        if (tipo === 'flipH') { ctxR.translate(300, 0); ctxR.scale(-1, 1); }
        else { ctxR.translate(0, 300); ctxR.scale(1, -1); }
        ctxR.drawImage(c1, 0, 0); ctxR.restore();
        const flipData = ctxR.getImageData(0, 0, 300, 300).data;
        for (let i = 0; i < flipData.length; i++) pr[i] = flipData[i];
    } else if (tipo === 'histEq') {
        equalizar(p1, pr);
    } else {
        for (let i = 0; i < p1.length; i += 4) {
            let r = p1[i], g = p1[i + 1], b = p1[i + 2];
            switch (tipo) {
                case 'soma': r += p2[i]; g += p2[i + 1]; b += p2[i + 2]; break;
                case 'sub': r -= p2[i]; g -= p2[i + 1]; b -= p2[i + 2]; break;
                case 'dif': r = Math.abs(r - p2[i]); g = Math.abs(g - p2[i + 1]); b = Math.abs(b - p2[i + 2]); break;
                case 'media': r = (r + p2[i]) / 2; g = (g + p2[i + 1]) / 2; b = (b + p2[i + 2]) / 2; break;
                case 'blend': let alpha = C / 255; r = r * alpha + p2[i] * (1 - alpha); g = g * alpha + p2[i + 1] * (1 - alpha); b = b * alpha + p2[i + 2] * (1 - alpha); break;
                case 'addC': r += C; g += C; b += C; break;
                case 'subC': r -= C; g -= C; b -= C; break;
                case 'multC': r *= (C / 50); g *= (C / 50); b *= (C / 50); break;
                case 'divC': let d = (C / 50) || 1; r /= d; g /= d; b /= d; break;
                case 'gray': let v = (r + g + b) / 3; r = g = b = v; break;
                case 'neg': r = 255 - r; g = 255 - g; b = 255 - b; break;
                case 'threshold': let t = (r + g + b) / 3 > C ? 255 : 0; r = g = b = t; break;
                case 'and': r &= p2[i]; g &= p2[i + 1]; b &= p2[i + 2]; break;
                case 'or': r |= p2[i]; g |= p2[i + 1]; b |= p2[i + 2]; break;
                case 'xor': r ^= p2[i]; g ^= p2[i + 1]; b ^= p2[i + 2]; break;
                case 'not': r = 255 - r; g = 255 - g; b = 255 - b; break;
            }
            pr[i] = clamp(r); pr[i + 1] = clamp(g); pr[i + 2] = clamp(b); pr[i + 3] = 255;
        }
    }
    ctxR.putImageData(out, 0, 0);
    updateHist(res, chartRes);
}

function aplicarFiltro(ent, sai, tipo) {
    const kG = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    for (let y = 0; y < 300; y++) {
        for (let x = 0; x < 300; x++) {
            let vR = [], vG = [], vB = [];
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    let py = Math.min(299, Math.max(0, y + ky)), px = Math.min(299, Math.max(0, x + kx));
                    let idx = (py * 300 + px) * 4;
                    vR.push(ent[idx]); vG.push(ent[idx + 1]); vB.push(ent[idx + 2]);
                }
            }
            let i = (y * 300 + x) * 4;
            if (tipo === 'fMedia') {
                sai[i] = vR.reduce((a, b) => a + b) / 9; sai[i + 1] = vG.reduce((a, b) => a + b) / 9; sai[i + 2] = vB.reduce((a, b) => a + b) / 9;
            } else if (tipo === 'fGauss') {
                let r = 0, g = 0, b = 0;
                vR.forEach((v, idx) => { r += v * kG[idx]; g += vG[idx] * kG[idx]; b += vB[idx] * kG[idx]; });
                sai[i] = r / 16; sai[i + 1] = g / 16; sai[i + 2] = b / 16;
            } else if (tipo === 'fModa') {
                const moda = a => {
                    let f = {}; a.forEach(v => f[v] = (f[v] || 0) + 1);
                    return parseInt(Object.keys(f).reduce((x, y) => f[x] > f[y] ? x : y));
                };
                sai[i] = moda(vR); sai[i + 1] = moda(vG); sai[i + 2] = moda(vB);
            } else {
                const med = a => [...a].sort((a, b) => a - b)[4]; sai[i] = med(vR); sai[i + 1] = med(vG); sai[i + 2] = med(vB);
            }
            sai[i + 3] = 255;
        }
    }
}

function equalizar(ent, sai) {
    let hist = new Array(256).fill(0);
    for (let i = 0; i < ent.length; i += 4) hist[Math.round((ent[i] + ent[i + 1] + ent[i + 2]) / 3)]++;
    let cdf = new Array(256).fill(0); cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
    let min = cdf.find(x => x > 0), tot = 300 * 300;
    for (let i = 0; i < ent.length; i += 4) {
        let g = Math.round((ent[i] + ent[i + 1] + ent[i + 2]) / 3);
        let e = ((cdf[g] - min) / (tot - min)) * 255;
        sai[i] = sai[i + 1] = sai[i + 2] = clamp(e); sai[i + 3] = 255;
    }
}

function salvarTudo() {
    if (res.width === 0) return;

    // 1. Salva a imagem do resultado
    const linkImg = document.createElement('a');
    linkImg.download = 'resultado_visual.png';
    linkImg.href = res.toDataURL();
    linkImg.click();

    // 2. Gera a imagem da MATRIZ (Zoom no topo esquerdo)
    const data = res.getContext('2d').getImageData(0, 0, 300, 300).data;
    const matCanvas = document.createElement('canvas');
    const mCtx = matCanvas.getContext('2d');

    const celula = 40; // Tamanho de cada quadradinho
    const tamAmostra = 15; // Vamos mostrar uma matriz 15x15 para caber na tela

    matCanvas.width = tamAmostra * celula;
    matCanvas.height = tamAmostra * celula;

    mCtx.textAlign = "center";
    mCtx.textBaseline = "middle";
    mCtx.font = "bold 14px Arial";

    for (let y = 0; y < tamAmostra; y++) {
        for (let x = 0; x < tamAmostra; x++) {
            let i = (y * 300 + x) * 4;
            let r = data[i], g = data[i + 1], b = data[i + 2];
            let cinza = Math.round((r + g + b) / 3);

            // Fundo colorido
            mCtx.fillStyle = `rgb(${r},${g},${b})`;
            mCtx.fillRect(x * celula, y * celula, celula, celula);

            // Grade
            mCtx.strokeStyle = "rgba(0,0,0,0.2)";
            mCtx.strokeRect(x * celula, y * celula, celula, celula);

            // Texto (contraste automático)
            mCtx.fillStyle = (cinza > 125) ? "black" : "white";
            mCtx.fillText(cinza, (x * celula) + (celula / 2), (y * celula) + (celula / 2));
        }
    }

    const linkMatriz = document.createElement('a');
    linkMatriz.download = 'matriz_amostra.png';
    linkMatriz.href = matCanvas.toDataURL();
    linkMatriz.click();
}
