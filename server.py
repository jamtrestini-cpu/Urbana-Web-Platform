# server.py — Backend URBANA (Flask + SQLite + Excel + Gmail SMTP + fotos + modelos 3D)
# Instalar:  pip install flask openpyxl
# Ejecutar:  python server.py   →  abre http://127.0.0.1:5000
import os, sqlite3, datetime, smtplib, ssl, json
from email.mime.text import MIMEText
from flask import Flask, request, jsonify, send_from_directory, render_template
from openpyxl import Workbook, load_workbook
# Rutas fijas para el servidor de PythonAnywhere
DB = "/home/javier1234567890/urbana.db"
XLSX = "/home/javier1234567890/ventas_urbana.xlsx"
IMG = "/home/javier1234567890/img"
MODELOS = "/home/javier1234567890/modelos"

BASE = os.path.dirname(os.path.abspath(__file__))
DB, XLSX, IMG, MODELOS = os.path.join(BASE, "urbana.db"), os.path.join(BASE, "ventas_urbana.xlsx"), os.path.join(BASE, "img"), os.path.join(BASE, "modelos")
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 35 * 1024 * 1024
EXT_PERMITIDAS = {"png", "jpg", "jpeg", "webp", "gif"}
EXT_MODELO = {"glb", "gltf"}

# ════════════════════════════ CORREO (Gmail SMTP) ════════════════════════════
# 1) Activa la verificación en 2 pasos en la cuenta de Gmail de la tienda.
# 2) Genera una contraseña de aplicación: myaccount.google.com/apppasswords
# 3) Pégala abajo. Puedes pegarla TAL CUAL te la muestra Gmail (con espacios);
#    el código ya se encarga de quitarlos.
EMAIL_TIENDA = ""   # ej: "tutienda@gmail.com"
EMAIL_APP_PW = ""   # ej: "abcd efgh ijkl mnop"

def enviar_correo(destino, asunto, cuerpo):
    """Función base: arma y manda un correo por Gmail. Nunca lanza una excepción hacia afuera —
    si algo falla, imprime por qué en la consola y devuelve False, para no tumbar la ruta que la llamó."""
    if not EMAIL_TIENDA or not EMAIL_APP_PW:
        print(f"⚠ [correo NO enviado] Falta llenar EMAIL_TIENDA / EMAIL_APP_PW arriba en server.py — asunto: {asunto}")
        return False
    if not destino:
        print(f"⚠ [correo NO enviado] No hay email de destino — asunto: {asunto}")
        return False
    clave = EMAIL_APP_PW.replace(" ", "")  # por si la pegaste con los espacios que muestra Gmail
    try:
        msg = MIMEText(cuerpo)
        msg["Subject"], msg["From"], msg["To"] = asunto, EMAIL_TIENDA, destino
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.starttls(context=ssl.create_default_context())
            s.login(EMAIL_TIENDA, clave)
            s.send_message(msg)
        print(f"✅ Correo enviado a {destino} — asunto: {asunto}")
        return True
    except smtplib.SMTPAuthenticationError:
        print("❌ Gmail rechazó el usuario/contraseña. Revisa en server.py:\n"
              "   1) EMAIL_TIENDA es el Gmail correcto de la tienda.\n"
              "   2) EMAIL_APP_PW es una CONTRASEÑA DE APLICACIÓN de 16 caracteres\n"
              "      (myaccount.google.com/apppasswords) — NO tu contraseña normal de Gmail.")
        return False
    except Exception as e:
        print(f"❌ Error enviando correo a {destino}: {e}")
        return False

# ── Funciones por propósito: cada una arma el texto y llama a enviar_correo ──
def notificar_nuevo_pedido(datos_cliente, productos, total):
    """Avisa al DUEÑO apenas un cliente manda su pedido a pago (antes de verificar el comprobante)."""
    nombre = datos_cliente.get("nombre", "Cliente")
    email_cliente = datos_cliente.get("email", "sin email")
    cuerpo = (f"Nuevo pedido recibido, pendiente de verificar el comprobante.\n\n"
              f"Cliente: {nombre}\nEmail: {email_cliente}\nProductos: {productos}\nTotal: ${total:.2f}\n\n"
              f"Confírmalo desde el panel de administración (⚙️ → Pedidos) cuando revises el pago.")
    return enviar_correo(EMAIL_TIENDA, f"🛒 Nuevo pedido de {nombre} — ${total:.2f}", cuerpo)

def notificar_pago_confirmado(nombre, email_cliente, productos, total, numero_pedido):
    """Se llama cuando el admin confirma el pago: avisa al CLIENTE y deja aviso a la tienda."""
    ok_cliente = enviar_correo(email_cliente, f"Tu pedido URBANA #{numero_pedido:05d} fue confirmado",
        f"Hola {nombre},\n\nConfirmamos tu pago.\nProductos: {productos}\nTotal: ${total:.2f}\n\n¡Gracias por tu compra!")
    ok_tienda = enviar_correo(EMAIL_TIENDA, f"Venta confirmada #{numero_pedido:05d}", f"{nombre} ({email_cliente}) — {productos} — ${total:.2f}")
    return ok_cliente, ok_tienda

def enviar_bienvenida_membresia(email_usuario, nombre="cliente"):
    """Correo de bienvenida cuando alguien CREA UNA CUENTA en URBANA (no confundir con la suscripción paga)."""
    cuerpo = f"Hola {nombre},\n\nTu cuenta en URBANA fue creada con éxito.\n¡Gracias por unirte!"
    return enviar_correo(email_usuario, "¡Bienvenido a URBANA!", cuerpo)

def notificar_solicitud_membresia(nombre, email_usuario, tarifa):
    """La solicitud de MEMBRESÍA MENSUAL (la paga): avisa al cliente y a la tienda. Esta es la que reportaste rota."""
    ok_cliente = enviar_correo(email_usuario, "Tu solicitud de Membresía Urbana",
        f"Hola {nombre},\n\nRecibimos tu solicitud de membresía mensual (${tarifa}/mes).\n"
        f"Un operador verificará tu pago y te enviará el código de activación por WhatsApp.")
    ok_tienda = enviar_correo(EMAIL_TIENDA, "Nueva solicitud de membresía", f"{nombre} ({email_usuario}) solicitó la membresía.")
    return ok_cliente, ok_tienda
# ═══════════════════════════════════════════════════════════════════════════

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS pedidos(
        id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, cliente TEXT, email TEXT,
        productos TEXT, items TEXT, total REAL, estado TEXT DEFAULT 'pendiente')""")
    c.execute("CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY, valor TEXT)")
    c.execute("""CREATE TABLE IF NOT EXISTS productos(
        id INTEGER PRIMARY KEY, n TEXT, c TEXT, p REAL, s INTEGER, img TEXT, tallas TEXT, modelo TEXT)""")
    return c

def migrar():
    with db() as c:
        cols = [r[1] for r in c.execute("PRAGMA table_info(productos)")]
        if "tallas" not in cols: c.execute("ALTER TABLE productos ADD COLUMN tallas TEXT DEFAULT ''")
        if "modelo" not in cols: c.execute("ALTER TABLE productos ADD COLUMN modelo TEXT DEFAULT ''")
migrar()

def seed():
    with db() as c:
        if not c.execute("SELECT 1 FROM productos LIMIT 1").fetchone():
            for row in [
                (1,"Camisa Casual Oxford","Camisas",45,20,"https://images.unsplash.com/photo-1603252109612-24fa03d145c8?auto=format&fit=crop&w=800&h=800&q=80",'["S","M","L","XL"]',""),
                (2,"Camiseta Essential Blanca","Camisetas",25,30,"https://images.unsplash.com/photo-1564859228273-274232fdb516?auto=format&fit=crop&w=800&h=800&q=80",'["S","M","L","XL"]',""),
                (3,"Pantalón Vaquero Clásico","Pantalones",60,15,"",'["28","30","32","34","36"]',""),
                (4,"Pantalón Cargo Urbano","Pantalones",55,12,"",'["28","30","32","34","36"]',""),
                (5,"Zapatilla Serie 500","Calzado",120,8,"https://images.unsplash.com/photo-1615743472612-93b21e520fad?auto=format&fit=crop&w=800&h=800&q=80",'["38","39","40","41","42","43","44"]',"")]:
                c.execute("INSERT INTO productos(id,n,c,p,s,img,tallas,modelo) VALUES(?,?,?,?,?,?,?,?)", row)
        if not c.execute("SELECT 1 FROM config LIMIT 1").fetchone():
            base = {"_v":"2","color":"#ce1126","fondo":"#08090c","texto":"#f2f4f7","bloques":"#131a24","heroImg":"",
                    "banner":"Las Serie 500","sub":"Diseño superior tejido y ligero que mejora la ventilación en tu día a día.",
                    "promo":"ENVÍOS GRATIS EN PEDIDOS SUPERIORES A $150.00","wa":"","tarifa":"5","codigo":"SOCIO10",
                    "datos":"TRANSFERENCIA\nBanco: [Banco]\nCuenta: [0000-0000-00-0000000000]\nTitular: [Nombre] · CI/RIF: [V-00000000]\n\nPAGO MÓVIL\nBanco: [Banco] · Tel: [0414-0000000] · CI: [V-00000000]"}
            for k, v in base.items():
                c.execute("INSERT INTO config(clave,valor) VALUES(?,?)", (k, v))
seed()

@app.after_request
def cors(r):
    r.headers.update({"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"})
    return r

@app.get("/")
def inicio(): return send_from_directory(BASE, "pagina web inicio.html")

# ── Correo de prueba: visita esta URL en el navegador para probar el SMTP solo ──
@app.get("/test-correo")
def test_correo():
    if not EMAIL_TIENDA:
        return jsonify(ok=False, error="Primero escribe tu Gmail en EMAIL_TIENDA, arriba en server.py")
    ok = enviar_correo(EMAIL_TIENDA, "Prueba de URBANA", "Si recibiste esto, tu Gmail quedó bien configurado.")
    return jsonify(ok=ok, revisa=("tu bandeja de entrada y la carpeta de spam" if ok else "la consola de Python — ahí está el motivo exacto"))

@app.get("/config")
def get_config():
    with db() as c: filas = c.execute("SELECT clave,valor FROM config").fetchall()
    return jsonify({r["clave"]: r["valor"] for r in filas})

@app.post("/config")
def set_config():
    d = request.get_json(force=True)
    with db() as c:
        for k, v in d.items():
            c.execute("INSERT INTO config(clave,valor) VALUES(?,?) ON CONFLICT(clave) DO UPDATE SET valor=?", (k, str(v), str(v)))
    return jsonify(ok=True)

@app.get("/productos")
def get_productos():
    with db() as c: filas = c.execute("SELECT * FROM productos ORDER BY id").fetchall()
    return jsonify([dict(r) for r in filas])

@app.post("/productos")
def set_productos():
    d = request.get_json(force=True)
    with db() as c:
        c.execute("DELETE FROM productos")
        for p in d:
            c.execute("INSERT INTO productos(id,n,c,p,s,img,tallas,modelo) VALUES(?,?,?,?,?,?,?,?)",
                      (p["id"], p["n"], p.get("c",""), p["p"], p["s"], p.get("img",""), json.dumps(p.get("tallas") or []), p.get("modelo","")))
    return jsonify(ok=True)

@app.post("/restablecer")
def restablecer():
    with db() as c: c.execute("DELETE FROM productos"); c.execute("DELETE FROM config")
    seed(); return jsonify(ok=True)

@app.post("/subir-imagen")
def subir_imagen():
    if "archivo" not in request.files: return jsonify(error="No se envió ninguna imagen"), 400
    f = request.files["archivo"]
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in EXT_PERMITIDAS: return jsonify(error="Formato no permitido (usa jpg, png, webp o gif)"), 400
    os.makedirs(IMG, exist_ok=True)
    nombre = f"{os.urandom(8).hex()}.{ext}"; f.save(os.path.join(IMG, nombre))
    return jsonify(url=f"/img/{nombre}")

@app.get("/img/<path:nombre>")
def servir_imagen(nombre): return send_from_directory(IMG, nombre)

@app.post("/subir-modelo")
def subir_modelo():
    if "archivo" not in request.files: return jsonify(error="No se envió ningún archivo"), 400
    f = request.files["archivo"]
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in EXT_MODELO: return jsonify(error="Formato no permitido (usa .glb o .gltf)"), 400
    os.makedirs(MODELOS, exist_ok=True)
    nombre = f"{os.urandom(8).hex()}.{ext}"; f.save(os.path.join(MODELOS, nombre))
    return jsonify(url=f"/modelos/{nombre}")

@app.get("/modelos/<path:nombre>")
def servir_modelo(nombre): return send_from_directory(MODELOS, nombre)

@app.post("/registro")
def registro():
    d = request.get_json(force=True)
    enviar_bienvenida_membresia(d.get("email"), d.get("nombre", "cliente"))
    return jsonify(ok=True)

@app.post("/pedido")
def crear_pedido():
    d = request.get_json(force=True)
    with db() as c:
        cur = c.execute("INSERT INTO pedidos(fecha,cliente,email,productos,items,total) VALUES(?,?,?,?,?,?)",
            (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), d["cliente"], d.get("email",""), d["productos"], d.get("items","[]"), float(d["total"])))
        pid = cur.lastrowid
    notificar_nuevo_pedido({"nombre": d["cliente"], "email": d.get("email","")}, d["productos"], float(d["total"]))
    return jsonify(id=pid, codigo=f"URB-{pid:05d}")

@app.get("/pedidos")
def listar(): return jsonify([dict(r) for r in db().execute("SELECT * FROM pedidos ORDER BY id DESC")])

@app.post("/confirmar-pago")
def confirmar_pago():
    d = request.get_json(force=True)
    with db() as c:
        p = c.execute("SELECT * FROM pedidos WHERE id=?", (d.get("id"),)).fetchone()
        if not p: return jsonify(error="Pedido no existe"), 404
        try:
            wb = load_workbook(XLSX) if os.path.exists(XLSX) else Workbook()
            if wb.active.max_row == 1 and wb.active["A1"].value is None:
                wb.active.append(["Fecha","Cliente","Email","Productos","Monto Total","Estado"])
            wb.active.append([p["fecha"], p["cliente"], p["email"], p["productos"], p["total"], "confirmado"])
            wb.save(XLSX)
            
        except PermissionError:
            return jsonify(error="Cierra ventas_urbana.xlsx en Excel e inténtalo de nuevo"), 423
        c.execute("UPDATE pedidos SET estado='confirmado' WHERE id=?", (p["id"],))
    notificar_pago_confirmado(p["cliente"], p["email"], p["productos"], p["total"], p["id"])
    return jsonify(ok=True)

@app.post("/suscripcion")
def suscripcion():
    d = request.get_json(force=True)
    notificar_solicitud_membresia(d.get("nombre", "cliente"), d.get("email"), d.get("tarifa", "?"))
    return jsonify(ok=True)

@app.get("/<path:f>")
def archivos(f):
    if not (f.endswith(".html") or f.endswith(".js") or f.endswith(".css")):
        return "No encontrado", 404
    return send_from_directory(BASE, f)



@app.route('/login')
def login():
    return render_template('login.html')  # O como lo tengas configurado para abrirlo



#if __name__ == '__main__':
                #app.run(debug=True, port=5001)