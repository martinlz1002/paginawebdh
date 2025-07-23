export interface TempUsuario {
  carreraId: string;
  range: { start: number; end: number };
  username: string;
  password: string;
  expiresAt: Date;
  createdAt: Date;
}