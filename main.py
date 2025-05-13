# Arquivo principal da aplicação Flask
import sys
import os

# Adiciona o diretório pai ao sys.path para permitir importações de src
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, render_template
from src.models.tabelas import db
from src.routes.api import api_bp
from src.extensions import socketio # Importar socketio de extensions

# Configuração do App
app = Flask(__name__, template_folder="src", static_folder="static")

# Configuração do Banco de Dados SQLite
# O arquivo do banco de dados será criado no diretório raiz do projeto Flask.
project_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(project_dir) # /home/ubuntu/gerenciador_tarefas
DATABASE_FILE = os.path.join(parent_dir, "gerenciador_tarefas.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_FILE}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "supersecretkey_dev_sqlite")

db.init_app(app) # Inicializa db com o app
socketio.init_app(app, async_mode="eventlet", cors_allowed_origins="*") # Inicializa socketio com o app

# Registrar Blueprints
app.register_blueprint(api_bp)

# Rota principal para servir o index.html
@app.route("/")
def index():
    return render_template("index.html")

# Eventos SocketIO básicos (podem ser expandidos ou movidos)
@socketio.on("connect")
def handle_connect():
    print("Cliente conectado ao WebSocket")

@socketio.on("disconnect")
def handle_disconnect():
    print("Cliente desconectado do WebSocket")

if __name__ == "__main__":
    with app.app_context():
        db.create_all() # Cria as tabelas no banco de dados se não existirem
    print(f"Iniciando servidor Flask com SocketIO e Eventlet. Banco de dados: {DATABASE_FILE}")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)

