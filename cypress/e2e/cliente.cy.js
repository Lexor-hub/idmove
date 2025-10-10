describe('Cliente', () => {
  beforeEach(() => {
    cy.login('cliente', 'senha123');
    cy.url().should('include', '/dashboard');
  });

  it('deve visualizar entregas e comprovantes', () => {
    cy.contains('Minhas Entregas');
    cy.get('[data-testid="entrega-item"]').should('exist');
  });

  it('deve buscar canhotos por data/NF', () => {
    cy.contains('Buscar por NF').click();
    cy.get('input[name="nf"]').type('12345');
    cy.contains('Buscar').click();
    cy.get('[data-testid="canhoto-item"]').should('contain', '12345');
  });

  it('deve monitorar entregas em tempo real', () => {
    cy.contains('Rastreamento').click();
    cy.get('.leaflet-container').should('exist');
  });

  it('deve gerar relatórios próprios', () => {
    cy.contains('Relatórios').click();
    cy.contains('Relatório de Cliente');
  });
}); 