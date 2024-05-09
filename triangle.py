from flask import Flask, render_template, request, redirect, url_for, jsonify, json, session
import os, cv2, fitz, base64, zipfile, platform, subprocess,argparse 
from PIL import Image
import numpy as np
from io import BytesIO
from flask_session import Session
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from flask_socketio import SocketIO

parser = argparse.ArgumentParser(description='triangle')
parser.add_argument('-g', '--gui', help='GUI')
args = parser.parse_args()

app = Flask(__name__, template_folder="templates", static_folder="static")
socketio = SocketIO(app)

IMPORT_FOLDER = os.path.join(os.path.expanduser("~/Documents"), "triangle/import/")
OUTPUT_FOLDER = os.path.join(os.path.expanduser("~/Documents"), "triangle/output/")
CONFIG_FILE = os.path.join(os.path.expanduser("~/Documents"), "triangle/config.json") 
PLATFORM = platform.system()
SERVER_ADDR = "http://127.0.0.1:5000"

if args.gui == "auto":
    GUI_AUTO = True
else:
    GUI_AUTO = False

os.makedirs(IMPORT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

if not os.path.exists(CONFIG_FILE):
    template = {
        "info": {
            "repo": "https://github.com/nouvellesarchives/triangle",
            "version": 0.1,
            "platform": PLATFORM 
        },
        "interface": {
            "lang": {
                "langs": ["EN"],
                "current": 0,
                "default": 0
            },
            "GUI": {
                "auto": False 
                }
        },
        "files": {
            "input": {
                "default": IMPORT_FOLDER,
                "custom": ""
            },
            "export": {
                "default": OUTPUT_FOLDER,
                "custom": ""
            }
        }
    }

    with open(CONFIG_FILE, 'w') as configFile:
        json.dump(template, configFile, indent=2)
else:
    with open(CONFIG_FILE, 'r') as configFile:
        configData = json.load(configFile)

with open(CONFIG_FILE, 'r') as configFile:
    configData = json.load(configFile)

app.config['IMPORT_FOLDER'] = IMPORT_FOLDER
app.config['SESSION_TYPE'] = 'filesystem'
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER 
app.config['CONFIG_FILE'] = CONFIG_FILE

print("""

       ███                ███                                ████          
     ░░███               ░░░                                ░░███          
     ███████   ████████  ████   ██████   ████████    ███████ ░███   ██████ 
    ░░░███░   ░░███░░███░░███  ░░░░░███ ░░███░░███  ███░░███ ░███  ███░░███
      ░███     ░███ ░░░  ░███   ███████  ░███ ░███ ░███ ░███ ░███ ░███████ 
      ░███ ███ ░███      ░███  ███░░███  ░███ ░███ ░███ ░███ ░███ ░███░░░  
      ░░█████  █████     █████░░████████ ████ █████░░███████ █████░░██████ 
       ░░░░░  ░░░░░     ░░░░░  ░░░░░░░░ ░░░░ ░░░░░  ░░░░░███░░░░░  ░░░░░░  
                                                    ███ ░███               
                                                   ░░██████                
                                                    ░░░░░░                 

      """)

print(f'▲ Version {configData["info"]["version"]} pour {configData["info"]["platform"]}')
print(f'▲ Default lang :            {configData["interface"]["lang"]["langs"][configData["interface"]["lang"]["default"]]}')
print(f"▲ Default Import folder :   {configData['files']['input']['default']}")
print(f"▲ Default Export folder :   {configData['files']['export']['default']}")
print(f"▲ Default Server Adress :   {SERVER_ADDR}")
print("    ")

Session(app)

if GUI_AUTO == True:
    configData["interface"]["GUI"]["auto"] = True

with open(CONFIG_FILE, 'w') as configFile:
    json.dump(configData, configFile, indent=2)


def openFolder(path, select):
    options = []
    if select:
        options = ["select"]

    execBash("xdg-open", path, options)

def execBash(c, args, options):
    if PLATFORM == "Darwin":
        if c == "xdg-open":
            c = "open"
        if "select" in options:
            c = "open -R"
    elif PLATFORM == "Linux":
        if c == "open":
            c = "xdg-open"
        if "select" in options:
            c = "xdg-open ."
    elif PLATFORM == "Windows":
        if c == "open" or c == "xdg-open":
            c = "start"
        if "select" in options:
            c = "explorer"

    subprocess.call(f"{c} {args}", shell=True)

def extractPreviews(page):
    imageBytes = page.get_pixmap().samples
    imagePIL = Image.frombytes("RGB", [page.get_pixmap().width, page.get_pixmap().height], imageBytes)
    imageCV2 = cv2.cvtColor(np.array(imagePIL), cv2.COLOR_RGB2BGR)

    _, imgEncoded = cv2.imencode('.webp', imageCV2, [cv2.IMWRITE_WEBP_QUALITY, 80])
    imgBase64 = base64.b64encode(imgEncoded).decode('utf-8')

    return imgBase64

def parExtract(inputPath):
    doc = fitz.open(inputPath)
    images = []

    for page_num, page in enumerate(doc.pages(), start=1):
        try:
            result = extractPreviews(page)
            images.append({"page": page_num, "data": result})
        except Exception as e:
            print(f"Error extractint image {e}")

    return images

def extractImage(inputPath, num, res, format, profile):
    doc = fitz.open(inputPath)
    image = "" 
    colorProfile = cv2.COLOR_RGB2BGR

    if (profile == "N&B"):
        colorProfile = cv2.COLOR_RGB2GRAY

    page = doc[int(int(num) - 1)]
    sf = res / 72
    pix = page.get_pixmap(matrix=fitz.Matrix(sf, sf))
    imagePIL = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    imageCV2 = cv2.cvtColor(np.array(imagePIL), colorProfile)

    ext = ".{}".format(format.lower())

    _, imgEncoded = cv2.imencode(ext, imageCV2)
    imgBase64 = base64.b64encode(imgEncoded).decode('utf-8')

    image = imgBase64

    return image

def extractImages(inputPath):
    doc = fitz.open(inputPath)
    images = []

    for pageNum in range(doc.page_count):
        page = doc[pageNum]
        imageBytes = page.get_pixmap().samples
        imagePIL = Image.frombytes("RGB", [page.get_pixmap().width, page.get_pixmap().height], imageBytes)
        imageCV2 = cv2.cvtColor(np.array(imagePIL), cv2.COLOR_RGB2BGR)

        _, imgEncoded = cv2.imencode('.png', imageCV2)
        imgBase64 = base64.b64encode(imgEncoded).decode('utf-8')

        images.append(imgBase64)
    return images

def orderPoints(pts):
    rect = np.zeros((4, 2), dtype='float32')

    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect

def transform(image, pts, ar):
    rect = orderPoints(pts)
    (tl, tr, br, bl) = rect

    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")

    M =  cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

    return warped

def b64toNdArray(b64str):
    data = base64.b64decode(b64str)
    image = Image.open(BytesIO(data))
    return np.array(image)

def ndArraytoB64(array, format):
    imgPIL = Image.fromarray(array)
    buff = BytesIO()
    imgPIL.save(buff, format=format.upper())
    return base64.b64encode(buff.getvalue()).decode()

@app.route('/folder', methods=['POST'])
def openFolderPOST():

    data = request.json
    options = data.get('options', [])
    arg = data.get('arg', "")

    path = ""
    selection = False

    if "select" in options:
        path = arg
        selection = True
    else:
        if "output" in options:
            if configData["files"]["export"]["custom"] == "":
                path = configData["files"]["export"]["default"]
      
    openFolder(path, selection)

    return jsonify({
        "msg": "Your output folder has been opened",
        "path": path,
        })  

class FileHandler(FileSystemEventHandler):
    def on_modified(self, event):
        self.process(event)
    def on_created(self, event):
        self.process(event)
    def on_deleted(self, event):
        self.process(event)

    def process(self, event):
        if event.src_path.endswith(".pdf"):
            files = [f for f in os.listdir(app.config['IMPORT_FOLDER']) if f.endswith(".pdf")]
            socketio.emit('updateList',
                          {'files': files},
                          namespace='/')

@app.route('/')
def index():
    files = [f for f in os.listdir(app.config['IMPORT_FOLDER']) if f.endswith(".pdf")]
    return render_template("index.html", files=files)

@app.route('/document/<file>')
def viewFile(file):
    inputPath = os.path.join(app.config['IMPORT_FOLDER'], file)
    page = int(request.args.get('p', 1))

    images = parExtract(inputPath) 
    session['extracedPreviews'] = images

    return render_template("view_doc.html", 
                           file=file, 
                           images=images, 
                           page=page)

@app.route('/editor', methods=['POST'])
def editeurREQ():

    data = request.json

    fname = data.get('file', '')
    selection = data.get('selection', [])
    inputPath = os.path.join(app.config['IMPORT_FOLDER'], fname)

    for i, o in enumerate(selection):
        res = 72
        data = base64.b64decode(o['data'])
        image = Image.open(BytesIO(data))
        width, height = image.size
        if width < 800:
            res = 150
        o['data'] = extractImage(inputPath, o['page'], res, "webp", "RVB")

    session['file'] = fname
    session['selection'] = selection

    return redirect(url_for('editeur'))

@app.route('/editeur/export', methods=['POST'])
def export():

    data = request.json
    format = data.get('format', "") 
    res = data.get("resolution", 72)
    selection = data.get('selection', [])
    profile = data.get('profile', "RVB")

    fname = session['file']
    inputPath = os.path.join(app.config['IMPORT_FOLDER'], fname)

    images = []

    for i, o in enumerate(selection):
        base = extractImage(inputPath, o['id'].split('-')[0], res, format, profile)
        imgArray = b64toNdArray(base)
        pointsNp = np.array([(point['x'], point['y']) for point in o['points']])
        prevDim = o.get("prevDim", {})

        sfW = imgArray.shape[1] / prevDim.get("width") 
        sfH = imgArray.shape[0] / prevDim.get("height")

        pScaled = pointsNp * np.array([sfW, sfH])

        warped = transform(imgArray, pScaled, o['aspectRatio'])

        warpedB64 = ndArraytoB64(warped, format) 

        newImage = {"data": warpedB64, "id": o['id']}
        images.append(newImage)

    zipFn = "t-{}.zip".format(fname.split(".")[0].replace(" ", "-"))
    zipPath = os.path.join(app.config['OUTPUT_FOLDER'], zipFn)

    with zipfile.ZipFile(zipPath, 'w') as zipFile:
        for i, image in enumerate(images):
            imgFn = "t-{}.{}".format(image['id'], format.lower())
            imgData = base64.b64decode(image['data'])
            zipFile.writestr(imgFn, imgData)

    request.close()

    print("Exported at : {}".format(zipPath))

    return jsonify({
        "fname": fname,
        "selection": selection,
        "images": images,
        "input": inputPath,
        "resolution": res,
        "format": format,
        "exportPath": zipPath,
        }) 

@app.route('/editor', methods=['GET'])
def editeur():

    fname = session.get('file', '')
    selection = session.get('selection', [])

    return render_template("editor.html", file=fname, previews=selection)

@app.route('/extract', methods=['POST'])
def process():

    resp = request.json

    ar = resp.get('aspectRatio')
    num = resp.get('num')
    points = resp.get('points')
    prevDim = resp.get('prevDim')
    data = resp.get('data')

    imgArray = b64toNdArray(data)

    pointsNp = np.array([(point['x'], point['y']) for point in points])

    sfW = imgArray.shape[1] / prevDim['width']
    sfH = imgArray.shape[0] / prevDim["height"]

    pointsScaled = pointsNp * np.array([sfW, sfH])

    warped = transform(imgArray, pointsScaled, ar)

    warpedB64 = ndArraytoB64(warped, "webp")

    id = num

    return jsonify({
        'id': id, 
        'data': warpedB64,
        'points': points,
        }) 

if __name__ == '__main__':
    event_handler = FileHandler()
    obserer = Observer()
    obserer.schedule(
            event_handler, 
            path=app.config['IMPORT_FOLDER'],
            recursive=True,
    )
    obserer.start()
    if GUI_AUTO or args.gui == "true":
        print(f"Starting GUI...")
        cmd = ["open", "./gui/mac/triangle.app", "--args", "--url=http://127.0.0.1:5000"] 
        subprocess.call(cmd)
    app.run(debug=False)
