describe('Motorista - Fluxo Completo', () => {
  beforeEach(() => {
    cy.login('motorista', 'senha123');
    cy.url().should('include', '/dashboard');
  });

  it('deve iniciar o dia e visualizar entregas', () => {
    cy.contains('Iniciar Dia').click();
    cy.contains('Dia Iniciado');
    cy.get('[data-testid="entrega-pendente"]').should('exist');
  });

  it('deve fazer upload de canhoto', () => {
    cy.contains('Iniciar Dia').click();
    cy.contains('Iniciar Rota').click();
    cy.get('[data-testid="entrega-pendente"]').first().within(() => {
      cy.contains('Fotografar').click();
      cy.get('input[type="file"]').attachFile('canhoto.jpg');
    });
    cy.contains('Upload realizado com sucesso');
  });

  it('deve importar XML da NF', () => {
    cy.contains('Importar XML').click();
    cy.get('input[type="file"]').attachFile('nota.xml');
    cy.contains('Importação realizada com sucesso');
  });

  it('deve marcar entrega como realizada', () => {
    cy.contains('Iniciar Dia').click();
    cy.contains('Iniciar Rota').click();
    cy.get('[data-testid="entrega-pendente"]').first().within(() => {
      cy.contains('Realizar Entrega').click();
    });
    cy.contains('Entrega marcada como realizada');
  });

  it('deve registrar ocorrência', () => {
    cy.contains('Iniciar Dia').click();
    cy.contains('Iniciar Rota').click();
    cy.get('[data-testid="entrega-pendente"]').first().within(() => {
      cy.contains('Problema').click();
    });
    cy.get('textarea[name="observacao"]').type('Destinatário ausente');
    cy.get('button[type="submit"]').click();
    cy.contains('Ocorrência registrada');
  });

  it('deve exibir localização e rota no mapa', () => {
    cy.contains('Minha Localização').click();
    cy.get('.leaflet-container').should('exist');
  });

  it('deve acessar histórico de viagens', () => {
    cy.contains('Histórico de Viagens').click();
    cy.contains('Viagens anteriores');
    cy.get('[data-testid="viagem-item"]').should('exist');
  });

  it('deve operar offline e sincronizar depois', () => {
    cy.goOffline();
    cy.contains('Iniciar Dia').click();
    cy.contains('Iniciar Rota').click();
    cy.get('[data-testid="entrega-pendente"]').first().within(() => {
      cy.contains('Fotografar').click();
      cy.get('input[type="file"]').attachFile('canhoto.jpg');
    });
    cy.goOnline();
    cy.contains('Sincronização concluída');
  });
}); 