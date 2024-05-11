let selected = null;
let resizeTimeout;
let stage;
let layer;
let selectedDim;
let points = [];
let color = '255, 0, 0';
let extract = [];
let exportList = [];
let ar;
let lZoom = [4, 2];
let coord;
let editDATA;
let changes;
let exportParams = {
  resolution: 0,
  format: 0,
  profile: 0,
  resolutions: [72, 100, 150, 300, 600],
  formats: ["PNG", "JPEG", "TIFF", "WEBP"],
  profiles: ["RVB", "N&B"]
};
let requests = [];
let adjustMode = false;
let adjustCtrl = { "crop": false }

function genNumSeq(lenght) {
  let seq = 0;

  for (let i = 0; i < lenght; i++) {
    const c = Math.floor(Math.random() * 10);
    seq += c.toString();
  }

  return Number(seq);
}

function recyleE() {
  let el = this;
  let id = el.getAttribute('ident');
  let data = exportList.find(item => item.id === id);

  exportList.splice(exportList.indexOf(data), 1);

  while (el.id !== 'peCard') {
    el = el.parentNode;
  }

  el.parentNode.removeChild(el);
  exportBtnDisplay();
}

function preExport() {
  let id = this.getAttribute('ident')
  let data = extract.find(item => item.id === id)

  if (exportList.length > 0) {
    let ids = exportList.map(item => item.id);
    let count = ids.filter(id => String(id).startsWith(id)).length;
    if (count > 0) { id = `${id}-${count}` }
  }

  let newExport = {
    'data': data.data,
    'id': id,
    'points': data.points,
    'prevDim': data.prevDim,
    'aspectRatio': data.aspectRatio,
  }

  exportList.push(newExport)
  updatePE(data, id)
  exportBtnDisplay();
}

function updatePE(data, id) {
  const d = document.getElementById('preExport')
  const c = document.createElement('div')
  c.style.position = 'relative'; c.id = 'peCard';

  const el = document.createElement('img');
  el.src = `data:image/webp;base64,${data.data}`;
  el.className = 'prevCard';
  el.style.cursor = 'auto';

  const s = document.createElement('span')
  s.style.position = 'absolute';
  s.style.margin = '0.5rem'
  s.style.display = 'flex'

  const rB = document.createElement('button')
  rB.id = 'recycle';
  rB.onclick = () => recyleE.call(rB);
  rB.setAttribute('ident', id);
  rB.className = 'btn-option'

  const rI = document.createElement('img')
  rI.src = '/static/icon/recycle.svg'

  rB.appendChild(rI)
  s.appendChild(rB)
  c.appendChild(s)
  d.appendChild(c)
  c.appendChild(el);
}

function previewPE() {
  if (selected) {
    let card = document.querySelector(`#prevBar > img[id='${selected.page}']`);

    if (card) {
      card.classList.toggle('selected');
    }
  }

  let id = this.getAttribute('ident')
  let data = extract.find(item => item.id === id)
  let origin = previews.find(item => item.page === Number(String(id).split('-')[0]))

  startEdit(data)
  selected = { "data": origin.data, "id": id, "points": data.points, "prevDim": data.prevDim }
}


function toggleAdjustementMode() { adjustMode = true; }

async function saveChanges(step, replace) {

  if (adjustCtrl.crop) {

    if (step === 808) {
      deconstructCropEdit();
      adjustCtrl.crop = false;
      return
    }

    if (step === 0) {
      const c = document.getElementById('savingUI');
      c.innerHTML = '';
      c.style.padding = '0.5rem';

      let s = document.createElement('span');
      let b = document.createElement('button');
      let b2 = document.createElement('button');

      s.id = 'savingCtrl';
      s.style.display = 'flex';
      s.style.gap = '0.5rem';
      b.className = 'button';
      b.style.width = '8rem';
      b.style.color = 'white';
      b.style.backgroundColor = 'blue';
      b.style.border = '1px solid blue';
      b.setAttribute("onclick", "saveChanges(1, true)");
      b.textContent = "Replace";

      b2.className = 'button';
      b2.style.width = '8rem';
      b2.setAttribute("onclick", "saveChanges(1, false)");
      b2.textContent = "Keep both";

      s.appendChild(b)
      s.appendChild(b2)
      c.appendChild(s)
      return
    }

    if (step === 1) {

      changes = {
        "crop": true, "origin": selected, "new": {
          "dim": selectedDim,
          "points": points,
        }
      };

      const body = JSON.stringify({
        num: changes.origin.id,
        data: changes.origin.data,
        points: changes.new.points,
        aspectRatio: ar,
        prevDim: changes.new.dim,
      });

      const resp = await fetch('http://127.0.0.1:5000/extract', {
        method: 'POST',
        headers: {
          "Content-Type": 'application/json',
        },
        body: body,
      });

      editSavingProcess(1);

      if (resp.ok) {
        data = await resp.json();

        let id;

        if (extract.length > 0) {
          let ids = extract.map(item => item.id);

          let count = ids.filter(id => String(data.id).startsWith(data.id)).length;

          if (count > 0) {
            id = `${data.id}-${count}`
          }

        } else {
          id = data.id
        }

        let newExtract = { 'data': data.data, 'id': String(id), 'points': data.points, 'prevDim': selectedDim }

        if (replace) {
          let el = document.querySelector(`#extractedPrevs > div > img[ident='${selected.id}']`);

          el.src = `data:image/webp;base64,${newExtract.data}`;

          let o = extract.find(item => item.id === selected.id);

          o.data = newExtract.data;
          o.points = newExtract.points;
          o.prevDim = selectedDim;

          selected.points = newExtract.points;
          selected.prevDim = selectedDim;
        } else if (!replace) {
          extract.push(newExtract);
          updateEP(data.data, id);
        }

        setTimeout(() => editSavingProcess(2), 0o500);
        setTimeout(() => editSavingProcess(3), 2000);

        return
      }
    }
  }
}

function editSavingProcess(step) {
  let pc = document.getElementById('editCanvasContainer');
  let p = document.createElement('p');
  let c;

  if (document.getElementById('savingProcess')) {
    c = document.getElementById('savingProcess');
    c.innerHTML = ''
  } else {
    c = document.createElement('div');
    c.id = 'savingProcess';
    pc.appendChild(c)
  }

  if (step === 1) {

    p.textContent = 'Saving…';
    p.style.color = 'green';
    p.style.padding = '0.5rem';
    p.style.backgroundColor = 'white';

    c.appendChild(p);

  } else if (step === 2) {

    p.textContent = 'The changes have been successfully applied!';
    p.style.display = 'flex';
    p.style.padding = '0.5rem';
    p.style.color = 'green';
    p.style.backgroundColor = 'white';

    c.appendChild(p);
  } else if (step === 3) {
    cropSavingCtrlDis(false, 'saving')
    c.remove()
    return
  }
}

function cropSavingCtrlDis(display, arg) {
  const c = document.getElementById('savingUI');

  if (display && arg === 'saving' && !document.getElementById('savingCtrl')) {
    c.innerHTML = '';
    c.style.padding = '0.5rem';

    let s = document.createElement('span');
    let b = document.createElement('button');
    let b2 = document.createElement('button');

    s.id = 'savingCtrl';
    s.style.display = 'flex';
    s.style.gap = '0.5rem';
    b.className = 'button';
    b.style.width = '7rem';
    b.style.color = 'white';
    b.style.backgroundColor = 'blue';
    b.style.border = '1px solid blue';
    b.setAttribute("onclick", "saveChanges(0, false)");
    b.textContent = "Save";

    b2.className = 'button';
    b2.style.width = '7rem';
    b2.setAttribute("onclick", "saveChanges(808, false)");
    b2.textContent = "Annuler";

    s.appendChild(b)
    s.appendChild(b2)
    c.appendChild(s)
  } else if (!display && arg === 'saving') {
    c.style.padding = '0';
    c.innerHTML = '';
  }
}
function deconstructCropEdit() {
  adjustMode = true;
  let o = extract.find(item => item.id === selected.id);

  adjustCtrl.crop = false;

  const g = document.getElementById('editGrid');
  g.remove();

  const a = document.getElementById('adjustCommands');
  a.style.gap = '0';

  cropSavingCtrlDis(false, 'saving');

  const p = document.getElementById('editModalContent')

  const ic = document.createElement('div');
  ic.id = 'imgContainer';

  const i = document.createElement('img');
  i.id = 'prevImg';
  i.src = `data:image/webp;base64,${o.data}`
  i.style.maxHeight = '50vh';
  i.style.minHeight = '30vh';

  ic.appendChild(i);
  p.appendChild(ic);
}

function constructCropEdit() {
  adjustMode = true;

  const p = document.getElementById('editModalContent')

  const ic = document.getElementById('imgContainer');
  ic.remove();

  const container = document.createElement('div');
  container.id = 'editGrid';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(12, 1fr)';
  container.style.height = '100vh';
  container.style.width = '100vw';
  container.style.padding = '2vh 2vw';
  p.appendChild(container);

  const canvasContainer = document.createElement('div');
  canvasContainer.id = 'editCanvasContainer';
  container.appendChild(canvasContainer)
  initEditCanvas();

  let origin = previews.find(item => item.page === Number(String(selected.id).split('-')[0]))
  drawPage(origin.data);
}

function initEditCanvas() {
  const old = document.getElementById('canvasContainer');
  if (old) { old.remove(); }
  initCanvas('editCanvasContainer');
}

function adjustToggleCtrl(arg) {
  if (arg !== '') {
    if (arg === 'crop') {
      let isActive = adjustCtrl.crop
      if (!isActive) {
        adjustCtrl.crop = true;
        document.getElementById('btn-crop').classList.toggle('actif');
        document.getElementById('cropIcon').classList.add('invert');
        constructCropEdit();
      } else if (isActive) {
        adjustCtrl.crop = false;
        document.getElementById('btn-crop').classList.toggle('actif');
        document.getElementById('cropIcon').classList.remove('invert');
        deconstructCropEdit();
      }
    }
  } else if (arg === '') {
    console.log('unknown control')
  }
}

function toggleLight() {
  document.getElementById('btn-on').classList.toggle('on')
  document.getElementById('btn-off').classList.toggle('on')
  document.getElementById('editModal').classList.toggle('dark')
}

function startEdit(data) {
  editDATA = data;
  document.getElementById('prevImg').src = 'data:image/webp;base64,' + data.data;
  document.getElementById('editModal').style.display = 'flex';
}

function cancelEdit() {
  document.getElementById('editModal').style.display = 'none';
  if (adjustCtrl.crop) { deconstructCropEdit(); }
  if (document.getElementById('canvasContainer')) {
    document.getElementById('canvasContainer').remove();
  }

  const i = document.getElementById('canvasZone');
  const c = document.createElement('div');
  c.id = 'canvasContainer';
  c.style.display = 'flex';
  c.style.justifyContent = 'center';
  c.style.gridColumn = '4 / 10';
  c.style.width = '100%';
  c.style.height = '100%';

  i.appendChild(c);
  initCanvas('canvasContainer');

  selected = null;

  const eb = document.getElementById('btn-extract');

  if (eb && eb.disabled == false) {
    eb.disabled = true;
  } else if (eb && eb.disabled == true) {
    eb.disabled = false;
  }
}

function updateEP(data, id) {
  const d = document.getElementById('extractedPrevs')
  const c = document.createElement('div')
  c.style.position = 'relative';

  const el = document.createElement('img');
  el.src = `data:image/webp;base64,${data}`;
  el.setAttribute('ident', id);
  el.className = 'prevCard';
  el.onclick = () => previewPE.call(el);

  const s = document.createElement('span')
  s.style.position = 'absolute';
  s.style.margin = '0.5rem'
  s.style.display = 'flex'

  const pB = document.createElement('button')
  pB.id = 'pre-export';
  pB.onclick = () => preExport.call(pB);
  pB.setAttribute('ident', id);
  pB.className = 'btn-option'
  const pI = document.createElement('img')
  pI.src = '/static/icon/export.svg'

  pB.appendChild(pI)
  s.appendChild(pB)
  c.appendChild(s)
  d.appendChild(c)
  c.appendChild(el);
}

function updateExportParams(p) {
  exportParams[p] = (exportParams[p] + 1) % exportParams[p + "s"].length;
  let value = document.getElementById("export-" + p + "-value");
  value.textContent = exportParams[p + "s"][exportParams[p]];
}

function exportBtnDisplay() {
  console.log(exportList)
  if (
    exportList.length > 0
    && !document.getElementById('export-block')) {

    const s = document.createElement('span');
    s.id = "export-block";
    s.style.display = 'flex';
    s.style.position = 'relative';

    const s2 = document.createElement('span');
    s2.style.position = 'absolute';
    s2.style.padding = '1rem';
    s2.style.gap = "0.5rem";
    s2.style.display = "flex";
    s2.style.left = '0';
    s2.style.right = '0';
    s2.style.bottom = '0';

    const s3 = document.createElement('span');
    s3.id = "export-ctrls"
    s3.style.gap = "0.5rem";
    s3.style.display = "flex";
    s3.style.width = "100%";
    s3.style.flexDirection = "column";

    const cancelBTN = document.createElement('button');
    cancelBTN.className = 'button';
    cancelBTN.style.color = "red";
    cancelBTN.setAttribute('onclick', "cancelExporting()");
    cancelBTN.style.width = '100%';
    cancelBTN.style.minWidth = "0";
    cancelBTN.textContent = 'Annuler';

    const exportBTN = document.createElement('button');
    exportBTN.className = 'button green';
    exportBTN.setAttribute('onclick', "startExporting()");
    exportBTN.style.minWidth = "0";
    exportBTN.style.width = '100%';
    exportBTN.textContent = 'Exporter';

    const c = document.getElementById('peInter');

    s3.appendChild(exportBTN);
    s2.appendChild(s3);
    s.appendChild(s2);
    c.appendChild(s);
  } else if (
    exportList.length <= 0
    && document.getElementById('export-block')) {

    const el = document.getElementById('export-block');
    if (el) {
      el.remove();
    }
  }
}

function cancelExporting() {

  exportParams = {
    resolution: 0,
    format: 0,
    resolutions: [72, 100, 150, 300, 600],
    formats: ["PNG", "JPEG", "TIFF", "WEBP"],
    profile: 0,
    profiles: ["RVB", "N&B"]
  };

  const c = document.getElementById('export-ctrls');
  c.innerHTML = "";

  const exportBTN = document.createElement('button');
  exportBTN.className = 'button green';
  exportBTN.setAttribute('onclick', "startExporting()");
  exportBTN.style.minWidth = "0";
  exportBTN.style.width = '100%';
  exportBTN.textContent = 'Exporter';

  c.appendChild(exportBTN);
}

function startExporting() {

  const c = document.getElementById("export-ctrls");
  c.innerHTML = "";

  const s = document.createElement('span');
  s.id = "export-ctrls"
  s.style.gap = "0.5rem";
  s.style.display = "flex";
  s.style.width = "100%";
  s.style.flexDirection = "column";

  const s2 = document.createElement('span');
  s2.style.display = "flex";
  s2.style.gap = "0.5rem";

  const profileBTN = document.createElement("button");
  profileBTN.classList.add("button");
  profileBTN.id = "export-profile-btn";
  profileBTN.style.color = "blue";
  profileBTN.style.minWidth = "0";
  profileBTN.style.width = "100%";
  profileBTN.setAttribute("onclick", "updateExportParams('profile')");

  const profileSPAN = document.createElement("span");
  profileSPAN.id = "export-profile-value";
  profileSPAN.textContent = exportParams.profiles[exportParams.profile];

  const formatBTN = document.createElement("button");
  formatBTN.classList.add("button");
  formatBTN.style.color = "blue";
  formatBTN.style.minWidth = "0";
  formatBTN.style.width = "100%";
  formatBTN.setAttribute("onclick", "updateExportParams('format')");

  const formatSPAN = document.createElement("span");
  formatSPAN.id = "export-format-value";
  formatSPAN.textContent = exportParams.formats[exportParams.format];

  const resBTN = document.createElement("button");
  resBTN.classList.add("button");
  resBTN.style.color = "blue";
  resBTN.style.minWidth = "0";
  resBTN.style.width = "100%";
  resBTN.setAttribute("onclick", "updateExportParams('resolution')");

  const resSPAN = document.createElement("span");
  resSPAN.id = "export-resolution-value";
  resSPAN.textContent = exportParams.resolutions[exportParams.resolution];

  const mSPAN = document.createElement("span");
  mSPAN.style.marginLeft = "0.1rem";
  mSPAN.style.fontSize = "0.5rem";
  mSPAN.textContent = "DPI";

  const exportSPAN = document.createElement("span");
  exportSPAN.style.display = "flex";
  exportSPAN.style.gap = "0.5rem";

  const s3 = document.createElement('span');
  s3.style.display = "flex";
  s3.style.gap = "0.5rem";

  const cancelBTN = document.createElement('button');
  cancelBTN.className = 'button';
  cancelBTN.style.color = "red";
  cancelBTN.setAttribute('onclick', "cancelExporting()");
  cancelBTN.style.width = '100%';
  cancelBTN.style.minWidth = "0";
  cancelBTN.textContent = 'Cancel';

  const exportBTN = document.createElement('button');
  exportBTN.className = 'button green';
  exportBTN.setAttribute('onclick', "exportation()");
  exportBTN.style.minWidth = "0";
  exportBTN.style.width = '100%';
  exportBTN.textContent = 'Export';

  resBTN.appendChild(resSPAN);
  resBTN.appendChild(mSPAN);
  s2.appendChild(resBTN);

  formatBTN.appendChild(formatSPAN);
  s2.appendChild(formatBTN);

  profileBTN.appendChild(profileSPAN);
  s2.appendChild(profileBTN);

  c.appendChild(s2);
  s3.appendChild(exportBTN);
  s3.appendChild(cancelBTN);
  c.appendChild(s2);
  c.appendChild(s3);
}

function supressInfoCard(i) {
  const container = document.getElementById("export-info-block");
  const card = document.getElementById(i);

  if (card) {
    container.removeChild(card);
  }
}

async function openFolder(path, options) {
  try {
    const body = JSON.stringify({
      options: options,
      arg: path
    });

    const resp = await fetch('http://127.0.0.1:5000/folder', {
      method: 'POST',
      headers: {
        "Content-Type": 'application/json',
      },
      body: body,
    });

    if (resp.ok) {
      data = await resp.json();
      console.log(data)
    }
  } catch (error) {
    console.log(error);
  }
}

function addEiCard(step, path, id, nb, res, format, profile) {
  let eiBlock;

  let i = "image(s)";

  if (nb >= 2) {
    i = "images";
  } else if (nb < 2) {
    i = "image";
  }

  if (document.getElementById("export-info-block")) {
    eiBlock = document.getElementById("export-info-block");
  } else if (!document.getElementById("export-info-block")) {
    const app = document.getElementById("app");
    const div = document.createElement("div");
    div.id = "export-info-block";
    div.classList.add("exportInfoBlock");
    app.appendChild(div);
    eiBlock = document.getElementById("export-info-block");
  }

  if (step == 1) {
    let msg;

    if (nb >= 2) {
      msg = [
        `We've put your ${nb} images in an`,
        path,
      ];
    } else if (nb < 2) {
      msg = [
        `We've put your image in an`,
        path,
      ];
    }

    supressInfoCard(`ic-${id}`)

    const c = document.createElement("div");
    c.classList.add("exportInfoCard");
    c.style.color = "green";
    c.id = `ic-${id}`;
    console.log(c.id);

    const s = document.createElement("span");
    s.style.display = "flex";
    s.style.gap = "0.5rem";
    s.style.alignItems = "center";
    s.style.color = "green";

    const s2 = document.createElement("span");
    s2.textContent = msg[0];

    const link = document.createElement("span");
    link.href = msg[1];
    link.textContent = "archive"
    link.setAttribute("onclick", `openFolder("${msg[1]}", ["select", "output"])`)
    link.style.color = "white";
    link.style.cursor = "alias";
    link.style.padding = "0.1rem 0.2rem";
    link.style.backgroundColor = "green";

    s.appendChild(s2);
    s.appendChild(link);
    c.appendChild(s);

    const tags = document.createElement("div");
    tags.id = "export-info-tags";

    function addTag(arg, color) {
      const s = document.createElement("span");

      if (arg == "N&B") {
        color = "0, 0, 0";
      }

      s.style.color = `rgba(${color}, 1)`;
      s.style.backgroundColor = `rgba(${color}, 0.04)`;
      s.textContent = arg;

      tags.appendChild(s);
    }

    addTag(`${res} DPI`, "255, 0, 0");
    addTag(`${format.toUpperCase()}`, "0, 128, 0");
    addTag(`${profile.toUpperCase()}`, "0, 0, 255");

    c.appendChild(s);
    c.appendChild(tags);
    eiBlock.appendChild(c);

    setTimeout(() => {
      supressInfoCard(`ic-${id}`)
    }, 4000)
  }

  if (step == 0) {
    const c = document.createElement("div");
    c.classList.add("exportInfoCard");
    c.id = `ic-${id}`;
    console.log(c.id);

    const s = document.createElement("span");
    s.style.display = "flex";
    s.style.gap = "0.5rem";
    s.style.alignItems = "center";

    const l = document.createElement("div");
    l.style.marginRight = "0.5rem";
    l.classList.add("dots-loader");
    // generate 3 divs
    for (let i = 0; i < 3; i++) {
      let d = document.createElement("div");
      l.appendChild(d);
    }

    const s2 = document.createElement("span");

    s2.textContent = `Exporting of ${nb} ${i}`;

    s.appendChild(l);
    s.appendChild(s2);
    c.appendChild(s);

    const tags = document.createElement("div");
    tags.id = "export-info-tags";

    function addTag(arg, color) {
      const s = document.createElement("span");

      if (arg == "N&B") {
        color = "0, 0, 0";
      }

      s.style.color = `rgba(${color}, 1)`;
      s.style.backgroundColor = `rgba(${color}, 0.04)`;
      s.textContent = arg;

      tags.appendChild(s);
    }

    addTag(`${res} DPI`, "255, 0, 0");
    addTag(`${format.toUpperCase()}`, "0, 128, 0");
    addTag(`${profile.toUpperCase()}`, "0, 0, 255");

    c.appendChild(s);
    c.appendChild(tags);
    eiBlock.appendChild(c);
  }
}

async function exportation() {

  const e = {
    id: `e-${genNumSeq(10)}`,
    selection: exportList,
    format: exportParams.formats[exportParams.format],
    resolution: exportParams.resolutions[exportParams.resolution],
    profile: exportParams.profiles[exportParams.profile],
  };

  const body = JSON.stringify({
    id: e.id,
    selection: e.selection,
    format: e.format,
    resolution: e.resolution,
    profile: e.profile,
  });

  addEiCard(
    0, "", e.id,
    e.selection.length,
    e.resolution,
    e.format,
    e.profile,
  );

  const resp = await fetch('http://127.0.0.1:5000/editor/export', {
    method: 'POST',
    headers: {
      "Content-Type": 'application/json',
    },
    body: body,
  });

  if (resp.ok) {
    data = await resp.json();
    console.log(data)

    setTimeout(() =>
      addEiCard(
        1,
        data.exportPath,
        e.id,
        e.selection.length,
        e.resolution,
        e.format,
        e.profile,
      ), 1 * 1000);
  }

}

async function extraction() {

  const body = JSON.stringify({
    num: selected.page,
    data: selected.data,
    points: points,
    aspectRatio: ar,
    prevDim: selectedDim,
  });

  const resp = await fetch('http://127.0.0.1:5000/extract', {
    method: 'post',
    headers: {
      "Content-Type": 'application/json',
    },
    body: body,
  });

  if (resp.ok) {
    data = await resp.json();

    let id;

    if (extract.length > 0) {
      let ids = extract.map(item => item.id);

      let count = ids.filter(id => String(data.id).startsWith(data.id)).length;

      if (count > 0) {
        id = `${data.id}-${count}`
      }

    } else {
      id = data.id
    }

    let newExtract = {
      'data': data.data,
      'id': String(id),
      'points': data.points,
      'prevDim': selectedDim,
      'aspectRatio': ar,
    }

    extract.push(newExtract);
    updateEP(data.data, id);
  }
}

function drawQ(source, kImage) {
  points = [];
  let loupeL;
  let l;
  let crossL;
  let vL;
  let hL;
  let quad;

  if (adjustCtrl.crop) {
    let o = selected.points
    let p = o.flatMap(point => {
      let xs = point.x * (stage.width() / selected.prevDim.width);
      console.log(xs)
      let ys = point.y * (stage.height() / selected.prevDim.height);
      console.log(ys)
      return [xs, ys];
    });

    quad = new Konva.Line({
      points: p,
      stroke: `rgba(${color}, 1)`,
      strokeWidth: 1,
      dash: [5, 5],
      closed: true,
    });

  } else {
    quad = new Konva.Line({
      points: [100, 100, 200, 100, 200, 200, 100, 200],
      stroke: `rgba(${color}, 1)`,
      strokeWidth: 1,
      dash: [5, 5],
      closed: true,
    });
  }

  layer.add(quad);

  for (let i = 0; i < quad.points().length; i += 2) {
    let circle = new Konva.Circle({
      x: quad.points()[i],
      y: quad.points()[i + 1],
      radius: 15,
      stroke: `rgba(${color}, 0.5)`,
      strokeWidth: 1,
      fill: `rgba(${color}, 0.2)`,
      draggable: true,
      name: 'circle',
    });

    points.push({ x: circle.x(), y: circle.y() });

    circle.on('dragstart', function() {
      let zoom = [4, 2, 1];
      let r = 50;

      loupeL = new Konva.Layer();
      document.body.style.cursor = 'none';
      circle.radius(r);
      stage.add(loupeL);
      circle.stroke('transparent')

      l = new Konva.Circle({
        radius: r,
        fillPatternImage: source,
        fillPatternScale: { x: zoom[2], y: zoom[2] },
        fillPatternOffset: { x: 0, y: 0 },
        stroke: `rgba(${color}, 0.5)`,
        fillPatternRepeat: 'no-repeat',
        strokeWidth: 1,
        name: 'loupe'
      });

      crossL = 20;

      hL = new Konva.Line({
        points: [
          circle.x() - crossL,
          circle.y(),
          circle.x() + crossL,
          circle.y(),
        ],
        stroke: `rgba(${color}, 0.5)`,
        strokeWidth: 1,
      });

      vL = new Konva.Line({
        points: [
          circle.x(),
          circle.y() - crossL,
          circle.x(),
          circle.y() + crossL,
        ],
        stroke: `rgba(${color}, 0.5)`,
        strokeWidth: 1,
      });

      loupeL.add(l, hL, vL);
      layer.draw();
    })

    circle.on('dragend', function() {
      circle.radius(15);
      circle.stroke(`rgba(${color}, 0.5)`)
      loupeL.destroy();
      layer.draw();
      document.body.style.cursor = 'all-scroll';
      if (adjustCtrl.crop) {
        cropSavingCtrlDis(true, 'saving');
      }
    })

    circle.on('dragmove', function() {
      let quadPoints = quad.points();
      quadPoints[i] = circle.x();
      quadPoints[i + 1] = circle.y();
      quad.points(quadPoints);
      points[i / 2] = { x: circle.x(), y: circle.y() };

      l.position({ x: circle.x(), y: circle.y() });
      l.fillPatternOffset({
        x: source.width * (circle.x() / kImage.width()),
        y: source.height * (circle.y() / kImage.height()),
      });

      vL.points([
        circle.x(),
        circle.y() - crossL,
        circle.x(),
        circle.y() + crossL,
      ]);

      hL.points([
        circle.x() - crossL,
        circle.y(),
        circle.x() + crossL,
        circle.y(),
      ]);

      loupeL.batchDraw()
      layer.batchDraw();
    });

    circle.on('mouseover', function() {
      document.body.style.cursor = 'all-scroll';
    });

    circle.on('mouseout', function() {
      document.body.style.cursor = 'default';
    });

    layer.add(circle);
  }

  layer.draw();
}

function isSelected(el) {
  return el.classList.contains('selected');
}

function selectPage(page) {
  let el = document.getElementById(page.page);
  if (el) { isSelected(el); }
  if (el) {
    if (!isSelected) {
      el.classList.toggle('selected');
    } else if (isSelected) {
      el.classList.toggle('selected');
    }
  }

  if (selected !== null) {
    el = document.getElementById(selected.page);
    if (el) { isSelected(el); }
    if (el) {
      if (!isSelected) {
        el.classList.toggle('selected');
      } else if (isSelected) {
        el.classList.toggle('selected');
      }
    }
  }

  const c = document.getElementById('btn-extract');
  if (c && c.disabled == true) {
    c.disabled = false;
  }

  selected = page;
  drawPage(page.data);
}

function drawPage(data) {
  const source = new Image();
  let id

  if (adjustCtrl.crop) {
    id = 'editCanvasContainer';
  } else {
    id = 'canvasContainer';
  }

  source.onload = function() {

    adjustCanvas(id);

    const sw = stage.width();
    const sh = stage.height();

    const sf = Math.min(sw / source.width, sh / source.height);
    ar = sf;

    const nw = source.width * sf;
    const nh = source.height * sf;

    stage.width(nw)
    stage.height(nh)

    const x = (nw / 2) - (nw / 2);
    const y = (sh / 2) - (nh / 2);

    coord = { x: x, y: y }

    const img = new Konva.Image({
      image: source,
      width: nw,
      height: nh,
    });

    layer.removeChildren();
    layer.add(img);
    layer.batchDraw();

    selectedDim = { width: nw, height: nh };

    console.log(`(source) width : ${source.width}, height ; ${source.height}`)
    console.log('(selected)', selectedDim)
    console.log(`(stage) width : ${stage.width()}, height ; ${stage.height()}`)

    drawQ(source, img);
    layer.batchDraw();
  };

  source.src = `data:image/webp;base64,${data}`;
}

function adjustCanvas(id) {
  const c = document.getElementById(id);
  stage.width(c.offsetWidth);
  stage.height(c.offsetHeight);
}

document.addEventListener('resize', function() {
  if (selected !== null) {
    drawPage(selected.data)
  }
})

function initCanvas(id) {
  points = [];

  stage = new Konva.Stage({
    container: id,
    width: 500,
    height: 500,
  });

  layer = new Konva.Layer();
  stage.add(layer);

  let c = document.querySelector('.konvajs-content canvas');
  c.style.border = '1px solid';

  adjustCanvas(id);

  points.forEach(point => {
    point.on('dragmove', function() {
      const x = point.x() / selectedDim.width;
      const y = point.y() / selectedDim.height;
    })
  })

}

document.addEventListener('DOMContentLoaded', function() {
  initCanvas('canvasContainer');
});

