let colOptions = [1, 3, 6];
let currentOptionIndex = 2;
let selectedImg = null;
var points = [];
let isSelectionMode = false;
let selection = [];
let slideShowIndex = 0;
let slideShowNature = "";

function slideShowPrev() {
  const i = document.getElementById("modalImage");
  let n = (slideShowIndex - 1 + images.length) % images.length
  slideShowIndex = n
  selectedImg = 'data:image/webp;base64,' + images[n].data;
  i.src = selectedImg;
}

function slideShowNext() {
  const i = document.getElementById("modalImage");
  let n = (slideShowIndex + 1) % images.length
  slideShowIndex = n
  selectedImg = 'data:image/webp;base64,' + images[n].data;
  i.src = selectedImg;
}

document.addEventListener("keydown", function(e) {
  if (global.slideShowIsOpen) {
    if (e.key == "ArrowRight" || e.key == "ArrowUp") {
      slideShowNext();
    } else if (e.key == "ArrowLeft" || e.key == "ArrowDown") {
      slideShowPrev();
    } else if (e.key == "Escape") {
      closeModal();
    }
  };
});

async function startEditing() {
  load();

  const fname = document.getElementById('fname').textContent;

  const body = JSON.stringify({
    "file": fname,
    "selection": selection,
  })

  const req = await fetch('/editor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body,
  })

  if (req.ok) {
    window.location.href = "/editor"
  } else {
    console.error("Erreur status :", req.status);
  }
}

function updateLenght() {
  const el = document.getElementById('selectionLenght');
  const editBTN = document.getElementById('btn-edit');

  if (isSelectionMode && selection.length > 0) {
    el.style.display = 'inline-block';
    el.textContent = selection.length
    editBTN.style.display = 'inline';
  } else {
    editBTN.style.display = 'none'
    el.style.display = 'none';
  }

  if (!isSelectionMode && selection.length > 0) {
    editBTN.style.display = 'inline';
  }
}

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  const el = document.getElementById('btn-sm');
  el.classList.toggle('actif')
  updateLenght();
};

function selectPrev(imgData) {
  if (isSelectionMode) {
    imageSelection(imgData);
  } else if (!isSelectionMode) {
    openModal(imgData.data);
    slideShowIndex = images.findIndex(img => img.data === selectedImg);
    state_openSlideShow();
  }
};

function imageSelection(data) {
  let element = document.getElementById('p-' + data.page);

  const isSelected = element.classList.contains('selected');

  if (element) {
    if (!isSelected) {
      selection.push({ "page": data.page, "data": data.data });
      element.classList.toggle('selected');
    } else if (isSelected) {
      const index = selection.findIndex(item => item.page === data.page);
      if (index !== -1) {
        selection.splice(index, 1);
      }
      element.classList.toggle('selected');
    }
  }
  updateLenght();
};

function updateGrid() {
  const grid = document.getElementById('prevGrid');
  const columnCount = colOptions[currentOptionIndex];
  grid.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
  document.getElementById('columnCount').innerText = columnCount;
  if (columnCount > 1) {
    document.getElementById('columnInd').innerText = "columns";
  } else {
    document.getElementById('columnInd').innerText = "column";
  }
}

function toggleColumns() {
  currentOptionIndex = (currentOptionIndex + 1) % colOptions.length;
  updateGrid();
}

function openEditor() {
  document.getElementById('editor').style.display = 'flex';
}

function openModal(imageDATA) {
  selectedImg = imageDATA;
  document.getElementById('modalImage').src = 'data:image/webp;base64,' + selectedImg;
  document.getElementById('imageModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('imageModal').style.display = 'none';
  state_openSlideShow();
}
