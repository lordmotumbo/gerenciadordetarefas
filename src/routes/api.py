# Rotas da API

from flask import Blueprint, request, jsonify
from src.models.tabelas import db, Pessoa, Tarefa
from src.extensions import socketio

api_bp = Blueprint("api", __name__, url_prefix="/api")

# --- Rotas para Pessoas ---
@api_bp.route("/pessoas", methods=["POST"])
def adicionar_pessoa():
    dados = request.get_json()
    if not dados or not dados.get("nome"):
        return jsonify({"erro": "Nome da pessoa é obrigatório"}), 400
    nova_pessoa = Pessoa(nome=dados["nome"])
    db.session.add(nova_pessoa)
    db.session.commit()
    socketio.emit("pessoas_atualizadas")
    return jsonify(nova_pessoa.to_dict()), 201

@api_bp.route("/pessoas", methods=["GET"])
def listar_pessoas():
    pessoas = Pessoa.query.order_by(Pessoa.nome).all()
    return jsonify([p.to_dict() for p in pessoas])

@api_bp.route("/pessoas/<int:id>", methods=["PUT"])
def editar_pessoa(id):
    pessoa = Pessoa.query.get_or_404(id)
    dados = request.get_json()
    if not dados or not dados.get("nome"):
        return jsonify({"erro": "Nome é obrigatório"}), 400
    pessoa.nome = dados["nome"]
    db.session.commit()
    socketio.emit("pessoas_atualizadas")
    return jsonify(pessoa.to_dict())

@api_bp.route("/pessoas/<int:id>", methods=["DELETE"])
def excluir_pessoa(id):
    pessoa = Pessoa.query.get_or_404(id)
    Tarefa.query.filter_by(pessoa_id=id).delete()
    db.session.delete(pessoa)
    db.session.commit()
    socketio.emit("pessoas_atualizadas")
    socketio.emit("tarefas_atualizadas", {"pessoa_id": id}) 
    return "", 204

# --- Rotas para Tarefas ---
@api_bp.route("/tarefas", methods=["POST"])
def adicionar_tarefa():
    dados = request.get_json()
    if not dados or not dados.get("descricao") or not dados.get("prioridade") or dados.get("pessoa_id") is None:
        return jsonify({"erro": "Descrição, prioridade e ID da pessoa são obrigatórios"}), 400
    
    max_ordem = db.session.query(db.func.max(Tarefa.ordem)).filter_by(pessoa_id=dados["pessoa_id"], concluida=False).scalar()
    nova_ordem = (max_ordem or 0) + 1

    nova_tarefa = Tarefa(
        descricao=dados["descricao"],
        prioridade=dados["prioridade"],
        horario_inicio=dados.get("horario_inicio"),
        pessoa_id=dados["pessoa_id"],
        ordem=nova_ordem
    )
    db.session.add(nova_tarefa)
    db.session.commit()
    socketio.emit("tarefas_atualizadas", {"pessoa_id": nova_tarefa.pessoa_id})
    return jsonify(nova_tarefa.to_dict()), 201

@api_bp.route("/tarefas/pessoa/<int:pessoa_id>", methods=["GET"])
def listar_tarefas_por_pessoa(pessoa_id):
    ordenacao_prioridade = db.case(
        (Tarefa.prioridade == "Alta", 1),
        (Tarefa.prioridade == "Media", 2),
        (Tarefa.prioridade == "Baixa", 3),
        else_=4 
    )
    # Ordenar primeiro por concluída (False vem antes de True), depois por prioridade, depois por ordem manual
    tarefas = Tarefa.query.filter_by(pessoa_id=pessoa_id)\
                        .order_by(Tarefa.concluida.asc(), ordenacao_prioridade, Tarefa.ordem).all()
    return jsonify([t.to_dict() for t in tarefas])

@api_bp.route("/tarefas/<int:id>", methods=["PUT"])
def editar_tarefa(id):
    tarefa = Tarefa.query.get_or_404(id)
    dados = request.get_json()
    
    tarefa.descricao = dados.get("descricao", tarefa.descricao)
    tarefa.prioridade = dados.get("prioridade", tarefa.prioridade)
    tarefa.horario_inicio = dados.get("horario_inicio", tarefa.horario_inicio)
    
    db.session.commit()
    socketio.emit("tarefas_atualizadas", {"pessoa_id": tarefa.pessoa_id})
    return jsonify(tarefa.to_dict())

@api_bp.route("/tarefas/<int:id>/concluir", methods=["PATCH"])
def concluir_tarefa(id):
    tarefa = Tarefa.query.get_or_404(id)
    tarefa.concluida = not tarefa.concluida
    db.session.commit()
    socketio.emit("tarefas_atualizadas", {"pessoa_id": tarefa.pessoa_id})
    return jsonify(tarefa.to_dict())

@api_bp.route("/tarefas/<int:id>", methods=["DELETE"])
def excluir_tarefa(id):
    tarefa = Tarefa.query.get_or_404(id)
    pessoa_id_afetada = tarefa.pessoa_id
    db.session.delete(tarefa)
    db.session.commit()
    socketio.emit("tarefas_atualizadas", {"pessoa_id": pessoa_id_afetada})
    return "", 204

@api_bp.route("/tarefas/reordenar", methods=["POST"])
def reordenar_tarefas():
    dados = request.get_json()
    pessoa_id = dados.get("pessoa_id")
    ids_tarefas_ordenadas = dados.get("ids_tarefas_ordenadas")

    if not pessoa_id or not ids_tarefas_ordenadas:
        return jsonify({"erro": "pessoa_id e ids_tarefas_ordenadas são obrigatórios"}), 400

    # Ao reordenar, apenas tarefas não concluídas devem ser consideradas para a ordem manual.
    # Tarefas concluídas sempre vão para o final.
    for index, tarefa_id in enumerate(ids_tarefas_ordenadas):
        tarefa = Tarefa.query.filter_by(id=tarefa_id, pessoa_id=pessoa_id, concluida=False).first()
        if tarefa:
            tarefa.ordem = index + 1
    
    db.session.commit()
    socketio.emit("tarefas_atualizadas", {"pessoa_id": pessoa_id})
    return jsonify({"mensagem": "Tarefas reordenadas com sucesso"})

