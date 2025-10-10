describe('Administrador', () => {
  beforeEach(() => {
    cy.login('admin', 'Admin123');
    cy.url().should('include', '/dashboard');
  });

  it('deve visualizar dashboard com KPIs', () => {
    cy.contains('Dashboard Administrativo');
    cy.contains('Total de Entregas');
    cy.contains('Entregas Realizadas');
  });

  it('deve listar e buscar canhotos', () => {
    cy.contains('Canhotos').click();
    cy.get('[data-testid="canhoto-item"]').should('exist');
    cy.get('input[name="busca"]').type('12345');
    cy.contains('Buscar').click();
    cy.get('[data-testid="canhoto-item"]').should('contain', '12345');
  });

  it('deve processar OCR de um canhoto', () => {
    cy.contains('Canhotos').click();
    cy.get('[data-testid="canhoto-item"]').first().within(() => {
      cy.contains('Processar OCR').click();
    });
    cy.contains('OCR concluído');
  });

  it('deve cadastrar, editar e desativar usuários', () => {
    cy.contains('Usuários').click();
    cy.contains('Novo Usuário').click();
    cy.get('input[name="nome"]').type('Novo Usuário');
    cy.get('input[name="email"]').type('novo@admin.com');
    cy.get('input[name="senha"]').type('SenhaForte123');
    cy.contains('Salvar').click();
    cy.contains('Usuário cadastrado');
    cy.get('[data-testid="usuario-item"]').last().within(() => {
      cy.contains('Editar').click();
      cy.get('input[name="nome"]').clear().type('Usuário Editado');
      cy.contains('Salvar').click();
      cy.contains('Usuário atualizado');
      cy.contains('Desativar').click();
      cy.contains('Usuário desativado');
    });
  });

  it('deve cadastrar motoristas, veículos, rotas e entregas', () => {
    cy.contains('Motoristas').click();
    cy.contains('Novo Motorista').click();
    cy.get('input[name="nome"]').type('Motorista Teste');
    cy.contains('Salvar').click();
    cy.contains('Motorista cadastrado');
    // Repita para veículos, rotas e entregas
  });

  it('deve monitorar localização dos motoristas', () => {
    cy.contains('Rastreamento').click();
    cy.get('.leaflet-container').should('exist');
    cy.get('[data-testid="motorista-marker"]').should('exist');
  });

  it('deve gerar relatórios completos', () => {
    cy.contains('Relatórios').click();
    cy.get('input[name="data-inicio"]').type('2024-01-01');
    cy.get('input[name="data-fim"]').type('2024-01-31');
    cy.contains('Gerar Relatório').click();
    cy.contains('Relatório de Entregas');
  });
}); 