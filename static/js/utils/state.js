let global = {
  userAgent: navigator.userAgent,
  onElectron: navigator.userAgent.includes('Electron'),
  slideShowIsOpen: false
}

function globalReset() {
  global = {
    userAgent: navigator.userAgent,
    onElectron: navigator.userAgent.includes('Electron'),
    slideShowIsOpen: false
  }
}

console.log("Global state", global);

function state_openSlideShow() {
  global.slideShowIsOpen = !global.slideShowIsOpen
  console.log(global.slideShowIsOpen)
  document.body.classList.toggle("sIsOpen");
}
