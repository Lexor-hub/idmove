describe('Login e Autenticação', () => {
  it('deve permitir login com credenciais válidas', () => {
    cy.visit('/login');
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('Admin123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.contains('Bem-vindo');
  });

  it('deve exibir erro com credenciais inválidas', () => {
    cy.visit('/login');
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('errada');
    cy.get('button[type="submit"]').click();
    cy.contains('Erro no login');
  });

  it('deve enviar email no fluxo de esqueci minha senha', () => {
    cy.visit('/login');
    cy.contains('Esqueceu a senha').click();
    cy.get('input[type="email"]').type('admin@admin.com');
    cy.get('button[type="submit"]').click();
    cy.contains('Email enviado');
  });
}); 