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
        aplicarFiltro(p1, pr, tipo, C);
    } else if (tipo.startsWith('m')) {
        aplicarMorfologia(p1, pr, tipo, C);
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

function aplicarFiltro(ent, sai, tipo, paramC) {
    const kG = [1, 2, 1, 2, 4, 2, 1, 2, 1]; 
    const kSobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kSobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    const kPrewittX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
    const kPrewittY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
    const kLaplace = [0, 1, 0, 1, -4, 1, 0, 1, 0];

    for (let y = 0; y < 300; y++) {
        for (let x = 0; x < 300; x++) {
            let i = (y * 300 + x) * 4;

            let vR = [], vG = [], vB = [];
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    let py = Math.min(299, Math.max(0, y + ky)), px = Math.min(299, Math.max(0, x + kx));
                    let idx = (py * 300 + px) * 4;
                    vR.push(ent[idx]); vG.push(ent[idx + 1]); vB.push(ent[idx + 2]);
                }
            }

            if (tipo === 'fMean') {
                sai[i] = vR.reduce((a, b) => a + b) / 9; 
                sai[i + 1] = vG.reduce((a, b) => a + b) / 9; 
                sai[i + 2] = vB.reduce((a, b) => a + b) / 9;
            } else if (tipo === 'fMin') {
                const minVal = a => [...a].sort((a, b) => a - b)[0];
                sai[i] = minVal(vR); sai[i + 1] = minVal(vG); sai[i + 2] = minVal(vB);
            } else if (tipo === 'fMax') {
                const maxVal = a => [...a].sort((a, b) => a - b)[8];
                sai[i] = maxVal(vR); sai[i + 1] = maxVal(vG); sai[i + 2] = maxVal(vB);
            } else if (tipo === 'fMediana') {
                const med = a => [...a].sort((a, b) => a - b)[4]; 
                sai[i] = med(vR); sai[i + 1] = med(vG); sai[i + 2] = med(vB);
            } else if (tipo === 'fOrdem') {
                let rankIdx = Math.min(8, Math.floor((paramC / 255) * 9));
                const ordVal = a => [...a].sort((a, b) => a - b)[rankIdx];
                sai[i] = ordVal(vR); sai[i + 1] = ordVal(vG); sai[i + 2] = ordVal(vB);
            } else if (tipo === 'fSuavizacao') {
                let centroR = ent[i], centroG = ent[i+1], centroB = ent[i+2];
                let vizR = [...vR], vizG = [...vG], vizB = [...vB];
                vizR.splice(4, 1); vizG.splice(4, 1); vizB.splice(4, 1); 
                
                vizR.sort((a,b)=>a-b); vizG.sort((a,b)=>a-b); vizB.sort((a,b)=>a-b);
                sai[i] = Math.max(vizR[0], Math.min(vizR[7], centroR));
                sai[i + 1] = Math.max(vizG[0], Math.min(vizG[7], centroG));
                sai[i + 2] = Math.max(vizB[0], Math.min(vizB[7], centroB));
            } else if (tipo === 'fGauss') {
                let r = 0, g = 0, b = 0;
                vR.forEach((v, idx) => { r += v * kG[idx]; g += vG[idx] * kG[idx]; b += vB[idx] * kG[idx]; });
                sai[i] = r / 16; sai[i + 1] = g / 16; sai[i + 2] = b / 16;
            } else if (tipo === 'fSobel' || tipo === 'fPrewitt') {
                let kX = (tipo === 'fSobel') ? kSobelX : kPrewittX;
                let kY = (tipo === 'fSobel') ? kSobelY : kPrewittY;
                
                let rx = 0, ry = 0, gx = 0, gy = 0, bx = 0, by = 0;
                vR.forEach((v, idx) => { rx += v * kX[idx]; ry += v * kY[idx]; });
                vG.forEach((v, idx) => { gx += v * kX[idx]; gy += v * kY[idx]; });
                vB.forEach((v, idx) => { bx += v * kX[idx]; by += v * kY[idx]; });
                
                sai[i] = Math.sqrt(rx * rx + ry * ry);
                sai[i + 1] = Math.sqrt(gx * gx + gy * gy);
                sai[i + 2] = Math.sqrt(bx * bx + by * by);
            } else if (tipo === 'fLaplace') {
                let r = 0, g = 0, b = 0;
                vR.forEach((v, idx) => { r += v * kLaplace[idx]; g += vG[idx] * kLaplace[idx]; b += vB[idx] * kLaplace[idx]; });
                sai[i] = r; sai[i + 1] = g; sai[i + 2] = b;
            }
            
            sai[i] = clamp(sai[i]);
            sai[i + 1] = clamp(sai[i + 1]);
            sai[i + 2] = clamp(sai[i + 2]);
            sai[i + 3] = 255;
        }
    }
}

function aplicarMorfologia(ent, sai, tipo, limiar) {
    let bin = new Uint8Array(300 * 300);
    for (let i = 0; i < ent.length; i += 4) {
        let gray = (ent[i] + ent[i + 1] + ent[i + 2]) / 3;
        bin[i / 4] = gray > limiar ? 255 : 0;
    }

    const dilat = (src, dst) => {
        for (let y = 0; y < 300; y++) {
            for (let x = 0; x < 300; x++) {
                let max = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        if (Math.abs(kx) + Math.abs(ky) > 1) continue; 
                        let py = Math.min(299, Math.max(0, y + ky)), px = Math.min(299, Math.max(0, x + kx));
                        let val = src[py * 300 + px];
                        if (val > max) max = val;
                    }
                }
                dst[y * 300 + x] = max;
            }
        }
    };

    const eros = (src, dst) => {
        for (let y = 0; y < 300; y++) {
            for (let x = 0; x < 300; x++) {
                let min = 255;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        if (Math.abs(kx) + Math.abs(ky) > 1) continue; 
                        let py = Math.min(299, Math.max(0, y + ky)), px = Math.min(299, Math.max(0, x + kx));
                        let val = src[py * 300 + px];
                        if (val < min) min = val;
                    }
                }
                dst[y * 300 + x] = min;
            }
        }
    };

    let temp1 = new Uint8Array(300 * 300);
    let temp2 = new Uint8Array(300 * 300);

    if (tipo === 'mDilatacao') {
        dilat(bin, temp1);
    } else if (tipo === 'mErosao') {
        eros(bin, temp1);
    } else if (tipo === 'mAbertura') {
        eros(bin, temp2);
        dilat(temp2, temp1);
    } else if (tipo === 'mFechamento') {
        dilat(bin, temp2);
        eros(temp2, temp1);
    } else if (tipo === 'mContorno') {
        eros(bin, temp2);
        for (let j = 0; j < bin.length; j++) {
            temp1[j] = bin[j] - temp2[j];
        }
    }

    for (let j = 0; j < temp1.length; j++) {
        let idx = j * 4;
        sai[idx] = temp1[j];
        sai[idx + 1] = temp1[j];
        sai[idx + 2] = temp1[j];
        sai[idx + 3] = 255;
    }
}

function equalizar(ent, sai) {
    let htmlHist = new Array(256).fill(0);
    for (let i = 0; i < ent.length; i += 4) htmlHist[Math.round((ent[i] + ent[i + 1] + ent[i + 2]) / 3)]++;
    let cdf = new Array(256).fill(0); cdf[0] = htmlHist[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + htmlHist[i];
    let min = cdf.find(x => x > 0), tot = 300 * 300;
    for (let i = 0; i < ent.length; i += 4) {
        let g = Math.round((ent[i] + ent[i + 1] + ent[i + 2]) / 3);
        let e = ((cdf[g] - min) / (tot - min)) * 255;
        sai[i] = sai[i + 1] = sai[i + 2] = clamp(e); sai[i + 3] = 255;
    }
}

function salvarTudo() {
    if (res.width === 0) return;

    const linkImg = document.createElement('a');
    linkImg.download = 'resultado_visual.png';
    linkImg.href = res.toDataURL();
    linkImg.click();

    const data = res.getContext('2d').getImageData(0, 0, 300, 300).data;
    const matCanvas = document.createElement('canvas');
    const mCtx = matCanvas.getContext('2d');

    const celula = 40; 
    const tamAmostra = 15; 

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

            mCtx.fillStyle = `rgb(${r},${g},${b})`;
            mCtx.fillRect(x * celula, y * celula, celula, celula);

            mCtx.strokeStyle = "rgba(0,0,0,0.2)";
            mCtx.strokeRect(x * celula, y * celula, celula, celula);

            mCtx.fillStyle = (cinza > 125) ? "black" : "white";
            mCtx.fillText(cinza, (x * celula) + (celula / 2), (y * celula) + (celula / 2));
        }
    }

    const linkMatriz = document.createElement('a');
    linkMatriz.download = 'matriz_amostra.png';
    linkMatriz.href = matCanvas.toDataURL();
    linkMatriz.click();
}
