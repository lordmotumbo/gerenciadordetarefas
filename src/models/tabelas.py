# Modelos do Banco de Dados

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Pessoa(db.Model):
    __tablename__ = 'pessoas'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    tarefas = db.relationship('Tarefa', backref='pessoa', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'tarefas': [tarefa.to_dict_simple() for tarefa in self.tarefas]
        }

class Tarefa(db.Model):
    __tablename__ = 'tarefas'
    id = db.Column(db.Integer, primary_key=True)
    descricao = db.Column(db.String(255), nullable=False)
    prioridade = db.Column(db.Enum('Baixa', 'Media', 'Alta', name='prioridade_enum'), nullable=False, default='Media')
    horario_inicio = db.Column(db.String(5), nullable=True)  # Formato HH:MM
    concluida = db.Column(db.Boolean, default=False, nullable=False)
    ordem = db.Column(db.Integer, nullable=False, default=0) # Para ordenação manual
    pessoa_id = db.Column(db.Integer, db.ForeignKey('pessoas.id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'descricao': self.descricao,
            'prioridade': self.prioridade,
            'horario_inicio': self.horario_inicio,
            'concluida': self.concluida,
            'ordem': self.ordem,
            'pessoa_id': self.pessoa_id,
            'pessoa_nome': self.pessoa.nome if self.pessoa else None
        }

    def to_dict_simple(self): # Para evitar recursão na serialização de Pessoa
        return {
            'id': self.id,
            'descricao': self.descricao,
            'prioridade': self.prioridade,
            'horario_inicio': self.horario_inicio,
            'concluida': self.concluida,
            'ordem': self.ordem,
            'pessoa_id': self.pessoa_id
        }

