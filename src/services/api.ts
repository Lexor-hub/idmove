import { supabase, requireSupabaseConfig } from '@/integrations/supabase/client';
import type { CompanyRow, DeliveryStatus, DriverStatus, ProfileRow } from '@/integrations/supabase/types';
import { todayBrt } from '@/lib/date';
import { normalizeBrazilianDocument } from '@/lib/documents';
import { normalizeRole } from '@/lib/roles';

export type ApiResponse<T> = { success: boolean; data?: T; error?: string };

export type ExtractedNfeData = {
  numero_nfe: string | null;
  cnpj_emitente: string | null;
  cnpj_destinatario: string | null;
  cnpj_transportadora: string | null;
  endereco_destinatario: string | null;
  nome_destinatario: string | null;
};

export type DriverLocationPayload = {
  driver_id: string | number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  delivery_id?: string | number | null;
};

export type DriverTrackingPointPayload = DriverLocationPayload & {
  session_id: string;
  recorded_at?: string;
};

export type TrackingHistoryFilters = {
  start_date?: string;
  end_date?: string;
};

type CurrentContext = {
  profile: ProfileRow;
  company: CompanyRow | null;
  driverId: string | null;
  clientId: string | null;
};

type AuthUserContext = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
};

type ApiDelivery = Record<string, any>;

const normalizeDeliveryStatus = (status?: string | null): DeliveryStatus => {
  const map: Record<string, DeliveryStatus> = {
    PENDING: 'PENDING',
    PENDENTE: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    IN_TRANSIT: 'IN_TRANSIT',
    EM_ANDAMENTO: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    REALIZADA: 'DELIVERED',
    FAILED: 'FAILED',
    PROBLEMA: 'FAILED',
    REFUSED: 'FAILED',
    CANCELED: 'CANCELLED',
    CANCELLED: 'CANCELLED',
  };
  return map[String(status || '').toUpperCase()] || 'PENDING';
};

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const todayIso = todayBrt;

// Traduz erros técnicos do Postgres/Supabase pra mensagens úteis ao operador.
// Cenários cobertos: duplicate key (23505), foreign key (23503), pgcrypto missing.
const translateKnownErrors = (raw: string): string | null => {
  const lower = raw.toLowerCase();
  if (lower.includes('23505') && lower.includes('profiles_auth_user_id_key')) {
    return 'Esse email já tem cadastro parcial no sistema (de uma tentativa anterior que falhou). Avise o suporte pra limpar o cadastro órfão antes de tentar de novo.';
  }
  if (lower.includes('23505') && (lower.includes('users_email') || lower.includes('email'))) {
    return 'Já existe um usuário cadastrado com esse email.';
  }
  if (lower.includes('gen_salt') && lower.includes('does not exist')) {
    return 'Extensão de criptografia do banco indisponível. Avise o suporte (pgcrypto search_path).';
  }
  if (lower.includes('permissão negada') || lower.includes('permission denied')) {
    return 'Você não tem permissão para essa ação.';
  }
  if (lower.includes('user already registered')) {
    return 'Já existe um usuário cadastrado com esse email.';
  }
  return null;
};

const responseError = (error: unknown) => {
  let raw = 'Erro interno';
  if (error instanceof Error) raw = error.message;
  else if (typeof error === 'string') raw = error;
  else if (error && typeof error === 'object') {
    const supabaseError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    if (parts.length > 0) raw = parts.join(' ');
  }
  return translateKnownErrors(raw) || raw;
};

const publicUrl = (bucket: string, path?: string | null) => {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem'));
    };
    image.src = url;
  });

const findBrightDocumentBounds = (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);

      if (brightness > 185 && spread < 70) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hits++;
      }
    }
  }

  if (hits < 100) return null;

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;
  const coversEnough = boundsWidth * boundsHeight > width * height * 0.25;
  if (!coversEnough) return null;

  const pad = Math.round(Math.min(width, height) * 0.015);
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    width: Math.min(width, maxX - minX + pad * 2),
    height: Math.min(height, maxY - minY + pad * 2),
  };
};

const prepareNfeImageForExtraction = async (file: File) => {
  try {
    const image = await loadImageFromFile(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = sourceWidth;
    probeCanvas.height = sourceHeight;

    const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) return { base64: await fileToBase64(file), contentType: file.type };

    probeCtx.drawImage(image, 0, 0);
    const imageData = probeCtx.getImageData(0, 0, sourceWidth, sourceHeight);
    const bounds = findBrightDocumentBounds(imageData.data, sourceWidth, sourceHeight) || {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    };

    const maxDimension = 2200;
    const scale = Math.min(maxDimension / Math.max(bounds.width, bounds.height), 2);
    const outputWidth = Math.max(1, Math.round(bounds.width * scale));
    const outputHeight = Math.max(1, Math.round(bounds.height * scale));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return { base64: await fileToBase64(file), contentType: file.type };

    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    outputCtx.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      outputWidth,
      outputHeight
    );

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.92);
    return { base64: dataUrl.split(',')[1], contentType: 'image/jpeg' };
  } catch {
    return { base64: await fileToBase64(file), contentType: file.type };
  }
};

class ApiService {
  private contextCache: CurrentContext | null = null;

  // Invalida o cache de contexto (profile/driver_id/company_id).
  // Deve ser chamado em todo logout e antes de cada login — sem isso o segundo
  // usuário no mesmo navegador herda o driver_id do primeiro e enxerga dados errados.
  clearContext(): void {
    this.contextCache = null;
  }

  private async run<T>(operation: () => Promise<T>): Promise<ApiResponse<T>> {
    try {
      requireSupabaseConfig();
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      console.error('[SupabaseApi]', error);
      return { success: false, error: responseError(error) };
    }
  }

  private async getContext(force = false, authUser?: AuthUserContext): Promise<CurrentContext> {
    if (this.contextCache && !force) return this.contextCache;

    let currentUser = authUser;
    if (!currentUser) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }
      currentUser = authData.user;
    }

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', currentUser.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error('Perfil nao encontrado no Supabase. Crie um profile para este usuario.');
      }

      const fullName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email ||
        'Master';

      const { data: bootstrapProfile, error: bootstrapError } = await supabase
        .from('profiles')
        .insert({
          auth_user_id: currentUser.id,
          company_id: null,
          username: currentUser.email || currentUser.id,
          email: currentUser.email || '',
          full_name: fullName,
          role: 'MASTER',
          status: 'ATIVO',
          is_active: true,
        })
        .select('*')
        .single();

      if (bootstrapError) throw bootstrapError;
      profile = bootstrapProfile;
    }

    const { data: company } = profile.company_id
      ? await supabase.from('companies').select('*').eq('id', profile.company_id).maybeSingle()
      : { data: null };

    const [{ data: driver }, { data: client }] = await Promise.all([
      supabase.from('drivers').select('id').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('clients').select('id').eq('profile_id', profile.id).maybeSingle(),
    ]);

    this.contextCache = {
      profile: profile as ProfileRow,
      company: (company as CompanyRow | null) || null,
      driverId: driver?.id || null,
      clientId: client?.id || null,
    };

    return this.contextCache;
  }

  private async companyId() {
    const context = await this.getContext();
    if (!context.profile.company_id && context.profile.role !== 'MASTER') {
      throw new Error('Usuario sem empresa vinculada.');
    }
    return context.profile.company_id;
  }

  private profileToUser(profile: ProfileRow, company?: CompanyRow | null, driverId?: string | null, clientId?: string | null) {
    return {
      id: profile.id,
      user_id: profile.auth_user_id || profile.id,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name,
      name: profile.full_name,
      role: profile.role,
      user_type: profile.role,
      cpf: profile.cpf || undefined,
      status: profile.status,
      is_active: profile.is_active,
      company_id: profile.company_id || undefined,
      company_name: company?.name,
      company_domain: company?.domain || undefined,
      driver_id: driverId || undefined,
      client_id: clientId || undefined,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  private mapDelivery(raw: ApiDelivery): ApiDelivery {
    const driver = Array.isArray(raw.drivers) ? raw.drivers[0] : raw.drivers;
    const client = Array.isArray(raw.clients) ? raw.clients[0] : raw.clients;
    const receipts = Array.isArray(raw.delivery_receipts)
      ? raw.delivery_receipts
      : raw.delivery_receipts
        ? [raw.delivery_receipts]
        : [];
    const receipt = receipts[0];
    const receiptUrl = receipt?.file_url || publicUrl('receipts', receipt?.file_path);
    const sourceDocUrl = raw.source_document_path
      ? publicUrl('delivery-documents', raw.source_document_path)
      : null;

    return {
      ...raw,
      id: String(raw.id),
      client_name: raw.client_name || client?.name || raw.client_name_extracted || 'Cliente',
      client_name_extracted: raw.client_name_extracted || raw.client_name || client?.name || 'Cliente',
      client_address: raw.client_address || raw.delivery_address,
      driver_name: driver?.name || 'Sem motorista',
      driver_id: raw.driver_id || null,
      vehicle_id: raw.vehicle_id || null,
      merchandise_value: String(raw.merchandise_value ?? 0),
      has_receipt: receipts.length > 0,
      receipt_id: receipt?.id || null,
      receipt_image_url: receiptUrl,
      receipt_notes: receipt?.notes || null,
      image_url: receiptUrl,
      source_document_url: sourceDocUrl,
      delivery_date: raw.delivered_at || raw.updated_at || raw.created_at,
      original_delivery_id: raw.original_delivery_id || null,
      attempt_number: Number(raw.attempt_number || 1),
      rescheduled_from_occurrence_id: raw.rescheduled_from_occurrence_id || null,
    };
  }

  private async uploadToBucket(bucket: string, file: File, prefix: string) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${prefix}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return { path, url: publicUrl(bucket, path) };
  }

  // Nota: o fallback `createUserViaSignup` foi removido em 04/06/2026.
  // Causava órfãos em auth.identities sempre que falhava no meio
  // (signUp criava auth.user + trigger criava profile com defaults;
  // INSERT manual subsequente dava 23505 e o catch deletava só o
  // auth.user, deixando profile pendurado). O RPC create_managed_user
  // já cobre 100% dos casos com search_path corrigido e UPSERT.

  async login(credentials: { username: string; password: string }) {
    // Limpa qualquer contexto residual antes do novo login — evita que o usuário entrante
    // herde driver_id/company_id do usuário anterior no mesmo navegador.
    this.clearContext();
    return this.run(async () => {
      const email = credentials.username.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: credentials.password,
      });
      if (error) throw error;
      if (!data.user || !data.session) throw new Error('Login sem sessao retornada.');

      const context = await this.getContext(true, data.user);
      return {
        token: data.session.access_token,
        user: this.profileToUser(context.profile, context.company, context.driverId, context.clientId),
      };
    });
  }

  async logout() {
    return this.run(async () => {
      this.clearContext();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    });
  }

  async selectCompany(companyId: string) {
    return this.run(async () => {
      const context = await this.getContext(true);
      let selectedCompany = context.company;

      if (context.profile.role === 'MASTER' && companyId && companyId !== context.profile.company_id) {
        const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
        if (error) throw error;
        selectedCompany = data as CompanyRow | null;
      }

      if (!selectedCompany) {
        throw new Error('Empresa selecionada nao encontrada ou sem permissao de acesso.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      return {
        token: sessionData.session?.access_token || '',
        user: this.profileToUser(context.profile, selectedCompany, context.driverId, context.clientId),
        company: selectedCompany,
      };
    });
  }

  async refreshCurrentSession() {
    return this.run(async () => {
      const context = await this.getContext(true);
      const { data: sessionData } = await supabase.auth.getSession();
      return {
        token: sessionData.session?.access_token || '',
        user: this.profileToUser(context.profile, context.company, context.driverId, context.clientId),
        company: context.company,
      };
    });
  }

  async getAuthCompanies() {
    return this.run(async () => {
      const context = await this.getContext();
      if (context.profile.role === 'MASTER') {
        const { data, error } = await supabase.from('companies').select('*').order('name');
        if (error) throw error;
        return data || [];
      }
      return context.company ? [context.company] : [];
    });
  }

  async getManagementCompanies() {
    return this.run(async () => {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (error) throw error;
      return data || [];
    });
  }

  async getCompanies() {
    return this.getManagementCompanies();
  }

  async createCompany(payload: Record<string, any>) {
    return this.run(async () => {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: payload.name,
          cnpj: payload.cnpj || null,
          domain: payload.domain || null,
          email: payload.email || null,
          subscription_plan: payload.subscription_plan || 'BASIC',
          max_users: Number(payload.max_users || 5),
          max_drivers: Number(payload.max_drivers || 2),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async updateCompany(companyId: string | number, payload: Record<string, any>) {
    return this.run(async () => {
      const { data, error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', String(companyId))
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async getUsers() {
    return this.run(async () => {
      let query = supabase
        .from('profiles')
        .select('*, companies(name, domain)')
        .order('created_at', { ascending: false });

      const ctx = await this.getContext();
      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((profile: any) => ({
        ...this.profileToUser(profile, profile.companies),
        company_name: profile.companies?.name,
        company_domain: profile.companies?.domain,
      }));
    });
  }

  async createUser(payload: Record<string, any>) {
    return this.run(async () => {
      const context = await this.getContext();
      const role = normalizeRole(payload.user_type || payload.role);
      const companyId = payload.company_id || context.profile.company_id;
      const fullName = payload.full_name || payload.name || payload.username || payload.email;
      const document = normalizeBrazilianDocument(payload.cpf || payload.document);
      const payloadEmail = String(payload.email || '').trim().toLowerCase();

      if (role !== 'MASTER' && !companyId) {
        throw new Error('Usuario sem empresa vinculada.');
      }

      // Pré-validação: se já existe profile com esse email, aborta ANTES de tentar
      // INSERT. Evita criar mais órfãos quando uma tentativa anterior falhou no meio.
      if (payloadEmail) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('email', payloadEmail)
          .maybeSingle();
        if (existingProfile) {
          throw new Error(
            `Já existe usuário cadastrado com o email ${payloadEmail} (${existingProfile.full_name} — ${existingProfile.role}). Verifique a lista de usuários.`
          );
        }
      }

      const tryRpc = async () => {
        const { data, error } = await supabase.rpc('create_managed_user', {
          p_email: payloadEmail,
          p_password: payload.password,
          p_full_name: fullName,
          p_role: role,
          p_company_id: companyId,
          p_username: payload.username || payload.email,
          p_cpf: document || null,
          p_status: payload.status || 'ATIVO',
        });
        if (error) throw error;

        const result = data as Record<string, any>;

        let userCompany = context.company;
        if (companyId && (!userCompany || userCompany.id !== companyId)) {
          const { data: fetchedCompany } = await supabase
            .from('companies')
            .select('*')
            .eq('id', String(companyId))
            .maybeSingle();
          userCompany = fetchedCompany as CompanyRow | null;
        }

        return {
          id: result.id,
          user_id: result.auth_user_id || result.id,
          username: result.username,
          email: result.email,
          full_name: result.full_name,
          name: result.full_name,
          role: result.role,
          user_type: result.role,
          cpf: document || undefined,
          status: result.status,
          is_active: result.is_active,
          company_id: companyId || undefined,
          company_name: userCompany?.name,
          company_domain: userCompany?.domain || undefined,
          driver_id: result.driver_id || undefined,
          client_id: result.client_id || undefined,
        };
      };

      return await tryRpc();
    });
  }

  async updateUser(userId: string | number, payload: Record<string, any>) {
    return this.run(async () => {
      const normalizedRole = (payload.user_type || payload.role) ? normalizeRole(payload.user_type || payload.role) : undefined;
      const document = normalizeBrazilianDocument(payload.cpf || payload.document);
      // email excluído intencionalmente: alterar profiles.email sem alterar auth.users.email
      // desincroniza a credencial de login. Email só pode ser mudado via fluxo de troca no Supabase Auth.
      const updatePayload: Record<string, any> = {
        full_name: payload.full_name || payload.name,
        username: payload.username,
        role: normalizedRole,
        cpf: document,
        status: payload.status,
        is_active: payload.is_active,
      };
      Object.keys(updatePayload).forEach((key) => updatePayload[key] === undefined && delete updatePayload[key]);

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', String(userId))
        .select()
        .single();
      if (error) throw error;

      if (normalizedRole === 'DRIVER') {
        const { data: existingDriver } = await supabase
          .from('drivers')
          .select('id')
          .eq('profile_id', String(userId))
          .maybeSingle();
        if (!existingDriver) {
          await supabase.from('drivers').insert({
            company_id: data.company_id,
            profile_id: String(userId),
            name: data.full_name,
            cpf: document || null,
            status: data.status || 'ATIVO',
          });
        }
      }

      if (normalizedRole === 'CLIENT') {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('profile_id', String(userId))
          .maybeSingle();
        if (existingClient) {
          await supabase
            .from('clients')
            .update({ name: data.full_name, document })
            .eq('profile_id', String(userId));
        } else {
          await supabase.from('clients').insert({
            company_id: data.company_id,
            profile_id: String(userId),
            name: data.full_name,
            email: data.email,
            document: document || null,
          });
        }
      }

      return data;
    });
  }

  async deleteUser(userId: string | number) {
    return this.run(async () => {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('auth_user_id')
        .eq('id', String(userId))
        .single();
      if (fetchError) throw fetchError;

      if (profile?.auth_user_id) {
        const { error: rpcError } = await supabase
          .rpc('delete_auth_user', { target_auth_user_id: profile.auth_user_id });
        if (rpcError) throw rpcError;
      } else {
        const { error } = await supabase.from('profiles').delete().eq('id', String(userId));
        if (error) throw error;
      }

      return { id: String(userId) };
    });
  }

  async getDrivers(filters?: Record<string, string>) {
    return this.run(async () => {
      let query = supabase.from('drivers').select('*, profiles(full_name, email)').order('name');
      if (filters?.status) query = query.eq('status', filters.status);

      const ctx = await this.getContext();
      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((driver: any) => ({
        ...driver,
        id: String(driver.id),
        name: driver.name || driver.profiles?.full_name || 'Motorista',
        userId: driver.profile_id,
      }));
    });
  }

  async createDriver(payload: Record<string, any>) {
    return this.run(async () => {
      const companyId = await this.companyId();
      const { data, error } = await supabase
        .from('drivers')
        .insert({
          company_id: payload.company_id || companyId,
          profile_id: payload.profile_id || payload.user_id || null,
          name: payload.name || payload.full_name,
          cpf: payload.cpf || null,
          phone: payload.phone || null,
          license: payload.license || null,
          status: payload.status || 'ATIVO',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async getVehicles() {
    return this.run(async () => {
      let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false });

      const ctx = await this.getContext();
      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  }

  async createVehicle(payload: Record<string, any>) {
    return this.run(async () => {
      const companyId = await this.companyId();
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          company_id: payload.company_id || companyId,
          plate: payload.plate,
          model: payload.model,
          brand: payload.brand || null,
          year: payload.year ? Number(payload.year) : null,
          color: payload.color || null,
          status: payload.status || 'ATIVO',
          driver_id: payload.driver_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async updateVehicle(vehicleId: string | number, payload: Record<string, any>) {
    return this.run(async () => {
      const { data, error } = await supabase.from('vehicles').update(payload).eq('id', String(vehicleId)).select().single();
      if (error) throw error;
      return data;
    });
  }

  async deleteVehicle(vehicleId: string | number) {
    return this.run(async () => {
      const { error } = await supabase.from('vehicles').delete().eq('id', String(vehicleId));
      if (error) throw error;
      return { id: String(vehicleId) };
    });
  }

  async getDeliveries(filters?: Record<string, string>): Promise<ApiResponse<ApiDelivery[]>> {
    return this.run(async () => {
      let query = supabase
        .from('deliveries')
        .select('*, drivers(name), clients(name), delivery_receipts(id,file_path,file_url,filename,status,notes,created_at)')
        .order('created_at', { ascending: false });

      const ctx = await this.getContext();
      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      if (filters?.driver_id) query = query.eq('driver_id', filters.driver_id);
      if (filters?.status) query = query.eq('status', normalizeDeliveryStatus(filters.status));
      if (filters?.scheduled_date) query = query.eq('scheduled_date', filters.scheduled_date);
      if (filters?.date_from) query = query.gte('scheduled_date', filters.date_from);
      if (filters?.date_to) query = query.lte('scheduled_date', filters.date_to);

      if (filters?.client === 'current' && ctx.clientId && !ctx.profile.view_company_data) {
        query = query.eq('client_id', ctx.clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((delivery) => this.mapDelivery(delivery));
    });
  }

  async getDelivery(deliveryId: string | number): Promise<ApiResponse<ApiDelivery>> {
    return this.run(async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, drivers(name), clients(name), delivery_receipts(id,file_path,file_url,filename,status,notes,created_at)')
        .eq('id', String(deliveryId))
        .single();
      if (error) throw error;
      return this.mapDelivery(data);
    });
  }

  async createDelivery(payload: Record<string, any>) {
    return this.run(async () => {
      const context = await this.getContext();
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');
      const structured = payload.structured || {};
      const summary = payload.summary || {};
      const nfData = structured.nf_data || {};
      const destinatario = structured.destinatario || {};
      const valores = structured.valores || {};
      const volumes = structured.volumes || {};

      let sourceDocumentPath: string | null = null;
      if (payload.file instanceof File) {
        sourceDocumentPath = (await this.uploadToBucket('delivery-documents', payload.file, `${companyId}/documents`)).path;
      }

      // Resolve client by CNPJ — find or create
      let clientId: string | null = payload.client_id || null;
      const cnpjRaw = payload.client_cnpj || '';
      const cnpjDigits = cnpjRaw.replace(/\D/g, '');
      const clientName = summary.clientName || destinatario.razao_social || payload.client_name || '';

      if (!clientId && cnpjDigits.length >= 11) {
        // Try to find existing client by CNPJ (document field)
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('company_id', companyId)
          .eq('document', cnpjDigits)
          .maybeSingle();

        if (existingClient) {
          clientId = String(existingClient.id);
        } else if (clientName) {
          // Create a new client record linked to this CNPJ
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              company_id: companyId,
              name: clientName,
              document: cnpjDigits,
            })
            .select('id')
            .single();

          if (!clientError && newClient) {
            clientId = String(newClient.id);
          }
        }
      }

      // Also try matching by client_name if no CNPJ was provided
      if (!clientId && clientName) {
        const { data: namedClient } = await supabase
          .from('clients')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', clientName)
          .maybeSingle();

        if (namedClient) {
          clientId = String(namedClient.id);
        }
      }

      const requestedDriverId = payload.driver_id && payload.driver_id !== 'none'
        ? String(payload.driver_id)
        : null;
      const driverId = requestedDriverId || context.driverId || null;
      const { data, error } = await supabase
        .from('deliveries')
        .insert({
          company_id: companyId,
          driver_id: driverId,
          client_id: clientId,
          nf_number: summary.nfNumber || nfData.numero || payload.nf_number || `NF-${Date.now()}`,
          client_name: clientName || 'Cliente nao informado',
          client_name_extracted: clientName || null,
          delivery_address: summary.deliveryAddress || destinatario.endereco || payload.delivery_address || 'Endereco nao informado',
          client_address: summary.deliveryAddress || destinatario.endereco || null,
          delivery_volume: Number(summary.volume || volumes.quantidade || payload.delivery_volume || 1),
          merchandise_value: asNumber(summary.merchandiseValue || valores.valor_total_nota || payload.merchandise_value, 0),
          scheduled_date: payload.scheduled_date || todayIso(),
          notes: payload.notes || summary.observations || null,
          status: driverId ? 'ASSIGNED' : 'PENDING',
          source_document_path: sourceDocumentPath,
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapDelivery(data);
    });
  }

  async getDashboardKPIs() {
    return this.run(async () => {
      const ctx = await this.getContext();
      const today = todayIso();
      const activeSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      let deliveriesQuery = supabase
        .from('deliveries')
        .select('*, drivers(name), clients(name), delivery_receipts(id,file_path,file_url,filename,status,notes,created_at)')
        .eq('scheduled_date', today)
        .order('created_at', { ascending: false });
      let driversQuery = supabase.from('drivers').select('id,current_status').in('current_status', ['online', 'active', 'idle']);
      let occurrencesQuery = supabase
        .from('occurrences')
        .select('id')
        .gte('created_at', `${today}T00:00:00-03:00`)
        .lte('created_at', `${today}T23:59:59-03:00`);
      let positionsQuery = supabase
        .from('v_motoristas_posicao')
        .select('motorista_id,company_id,updated_at')
        .eq('is_active', true)
        .gte('updated_at', activeSince);

      if (ctx.profile.role !== 'MASTER') {
        deliveriesQuery = deliveriesQuery.eq('company_id', ctx.profile.company_id);
        driversQuery = driversQuery.eq('company_id', ctx.profile.company_id);
        occurrencesQuery = occurrencesQuery.eq('company_id', ctx.profile.company_id);
        positionsQuery = positionsQuery.eq('company_id', ctx.profile.company_id);
      }

      const [
        { data: deliveries, error: deliveriesError },
        { data: drivers, error: driversError },
        { data: occurrences, error: occurrencesError },
        { data: positions, error: positionsError },
      ] = await Promise.all([deliveriesQuery, driversQuery, occurrencesQuery, positionsQuery]);

      if (deliveriesError) throw deliveriesError;
      if (driversError) throw driversError;
      if (occurrencesError) throw occurrencesError;
      if (positionsError) throw positionsError;

      const list = deliveries || [];
      const activePositionDrivers = new Set((positions || []).map((position) => position.motorista_id));
      return {
        today_deliveries: {
          total: list.length,
          completed: list.filter((item) => item.status === 'DELIVERED').length,
          pending: list.filter((item) => item.status === 'PENDING' || item.status === 'ASSIGNED').length,
          in_progress: list.filter((item) => item.status === 'IN_TRANSIT').length,
          failed: list.filter((item) => item.status === 'FAILED').length,
          list: list.map((delivery) => this.mapDelivery(delivery)),
        },
        pending_occurrences: occurrences?.length || 0,
        active_drivers: Math.max(drivers?.length || 0, activePositionDrivers.size),
      };
    });
  }

  async getRecentDeliveryEvents(limit = 5) {
    return this.run(async () => {
      const ctx = await this.getContext();
      let query = supabase
        .from('delivery_events')
        .select('*, deliveries(nf_number,client_name), drivers(name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((event: any) => ({
        id: String(event.id),
        type: event.event_type || 'PENDING',
        nf_number: event.deliveries?.nf_number || 'N/A',
        client_name: event.deliveries?.client_name || 'Cliente',
        driver_name: event.drivers?.name || 'Motorista',
        description: event.description || event.event_type || 'Atualizacao registrada',
        created_at: event.created_at,
      }));
    });
  }

  async sendDriverLocation(payload: DriverLocationPayload) {
    return this.run(async () => {
      const context = await this.getContext();
      const driverId = String(payload.driver_id || context.driverId || '');
      if (!driverId) throw new Error('Motorista nao identificado.');
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');

      const { data, error } = await supabase
        .from('tracking_points')
        .insert({
          company_id: companyId,
          driver_id: driverId,
          delivery_id: payload.delivery_id || null,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy: payload.accuracy ?? null,
          speed: payload.speed ?? null,
          heading: payload.heading ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('drivers').update({ current_status: 'active' }).eq('id', driverId);
      return data;
    });
  }

  async startDriverTracking(driverId: string | number, platform?: string) {
    return this.run(async () => {
      const { data, error } = await supabase.rpc('start_driver_tracking', {
        p_motorista_id: String(driverId),
        p_platform: platform || null,
      });
      if (error) throw error;
      if (!data) throw new Error('Sessao de rastreamento nao criada.');
      return { session_id: String(data) };
    });
  }

  async recordDriverLocation(payload: DriverTrackingPointPayload): Promise<ApiResponse<void>> {
    return this.run(async () => {
      const { error } = await supabase.rpc('record_driver_location', {
        p_session_id: payload.session_id,
        p_motorista_id: String(payload.driver_id),
        p_latitude: payload.latitude,
        p_longitude: payload.longitude,
        p_accuracy_m: payload.accuracy ?? null,
        p_speed_kmh: payload.speed ?? null,
        p_heading_deg: payload.heading ?? null,
        p_recorded_at: payload.recorded_at || new Date().toISOString(),
        p_delivery_id: payload.delivery_id ? String(payload.delivery_id) : null,
      });
      if (error) throw error;
    });
  }

  async finishDriverTracking(driverId: string | number, sessionId: string): Promise<ApiResponse<void>> {
    return this.run(async () => {
      const { error } = await supabase.rpc('finish_driver_tracking', {
        p_session_id: sessionId,
        p_motorista_id: String(driverId),
      });
      if (error) throw error;
    });
  }

  async upsertDriverPosition(driverId: string, latitude: number, longitude: number): Promise<ApiResponse<void>> {
    return this.run(async () => {
      const { error } = await supabase.rpc('upsert_driver_position', {
        p_motorista_id: driverId,
        p_latitude: latitude,
        p_longitude: longitude,
      });
      if (error) throw error;
    });
  }

  async getActiveDriverLocations() {
    return this.run(async () => {
      const ctx = await this.getContext();
      let query = supabase
        .from('v_motoristas_posicao')
        .select('motorista_id,driver_name,company_id,session_id,is_active,latitude,longitude,accuracy_m,speed_kmh,heading_deg,recorded_at,updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((point: any) => ({
        driver_id: point.motorista_id,
        session_id: point.session_id,
        driver_name: point.driver_name || 'Motorista',
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy_m || 0,
        speed: point.speed_kmh || 0,
        heading: point.heading_deg || 0,
        last_update: point.updated_at,
        recorded_at: point.recorded_at,
        status: 'active',
        activity_status: 'active',
        current_delivery_id: null,
      }));
    });
  }

  async getCurrentLocations() {
    return this.getActiveDriverLocations();
  }

  async getTrackingHistory(driverId: string | number, filters?: TrackingHistoryFilters) {
    return this.run(async () => {
      let query = supabase.from('tracking_points').select('*').eq('driver_id', String(driverId)).order('created_at');
      if (filters?.start_date) query = query.gte('created_at', filters.start_date);
      if (filters?.end_date) query = query.lte('created_at', filters.end_date);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((point: any) => ({ ...point, timestamp: point.created_at }));
    });
  }

  // Atualiza campos extras do driver criados por fluxos auxiliares (DriverForm),
  // já que o RPC create_managed_user só popula name/cpf/status.
  async updateDriver(driverId: string | number, payload: Record<string, any>) {
    return this.run(async () => {
      const updates: Record<string, any> = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.cpf !== undefined) updates.cpf = normalizeBrazilianDocument(payload.cpf);
      if (payload.phone !== undefined) updates.phone = payload.phone || null;
      if (payload.license !== undefined) updates.license = payload.license || null;
      if (payload.status !== undefined) updates.status = payload.status;
      if (Object.keys(updates).length === 0) {
        return { id: String(driverId) };
      }
      const { data, error } = await supabase
        .from('drivers')
        .update(updates)
        .eq('id', String(driverId))
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async updateDriverStatus(driverId: string | number, status: DriverStatus) {
    return this.run(async () => {
      const { data, error } = await supabase
        .from('drivers')
        .update({ current_status: status })
        .eq('id', String(driverId))
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async attachReceipt(deliveryId: string | number, driverId: string | number | null, file: File, options?: { notes?: string; status?: string }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('delivery_id', String(deliveryId));
    if (driverId) formData.append('driver_id', String(driverId));
    if (options?.notes) formData.append('notes', options.notes);
    return this.uploadReceipt(formData);
  }

  async uploadReceipt(formData: FormData) {
    return this.run(async () => {
      const context = await this.getContext();
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');
      const file = formData.get('file');
      if (!(file instanceof File)) throw new Error('Arquivo nao encontrado.');
      const deliveryId = String(formData.get('delivery_id') || formData.get('deliveryId') || '');
      const driverId = String(formData.get('driver_id') || formData.get('driverId') || context.driverId || '');
      if (!deliveryId) throw new Error('Entrega nao informada.');

      const upload = await this.uploadToBucket('receipts', file, `${companyId}/${deliveryId}`);
      const { data, error } = await supabase
        .from('delivery_receipts')
        .insert({
          company_id: companyId,
          delivery_id: deliveryId,
          driver_id: driverId || null,
          file_path: upload.path,
          file_url: upload.url,
          filename: file.name,
          status: 'UPLOADED',
          notes: String(formData.get('notes') || '') || null,
        })
        .select()
        .single();
      if (error) throw error;

      // CRÍTICO: verificar se o UPDATE foi aplicado. Sem .select() o Supabase não
      // retorna erro quando RLS bloqueia silenciosamente — usamos .select() para confirmar.
      const { data: updatedDelivery, error: updateError } = await supabase
        .from('deliveries')
        .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .select('id, status')
        .single();

      if (updateError) {
        console.error('[uploadReceipt] Falha ao atualizar status da entrega para DELIVERED:', updateError);
        throw new Error('Canhoto salvo, mas não foi possível finalizar a entrega. Tente novamente ou contate o suporte.');
      }

      return { ...data, receipt_image_url: upload.url, image_url: upload.url, delivery_status: updatedDelivery?.status };
    });
  }

  async getReceipts(filters?: Record<string, string>) {
    return this.getCanhotos(filters);
  }

  async getCanhotos(filters?: Record<string, string>) {
    return this.run(async () => {
      const ctx = await this.getContext();

      // CLIENT: limita por client_id (busca os IDs das entregas próprias antes)
      // Exceção: clientes "demo" (view_company_data=true) veem tudo da empresa.
      let allowedDeliveryIds: string[] | null = null;
      if (ctx.profile.role === 'CLIENT' && ctx.clientId && !ctx.profile.view_company_data) {
        const { data: deliveryRows } = await supabase
          .from('deliveries')
          .select('id')
          .eq('client_id', ctx.clientId);
        allowedDeliveryIds = (deliveryRows || []).map((row: any) => String(row.id));
        if (allowedDeliveryIds.length === 0) return [];
      }

      let query = supabase
        .from('delivery_receipts')
        .select('*, deliveries(nf_number,client_name,client_id,delivered_at,scheduled_date), drivers(name)')
        .order('created_at', { ascending: false });

      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }
      if (ctx.profile.role === 'DRIVER' && ctx.driverId) {
        query = query.eq('driver_id', ctx.driverId);
      }
      if (allowedDeliveryIds) {
        query = query.in('delivery_id', allowedDeliveryIds);
      }

      if (filters?.delivery_id) query = query.eq('delivery_id', filters.delivery_id);
      if (filters?.driver_id) query = query.eq('driver_id', filters.driver_id);
      if (filters?.date_from) query = query.gte('created_at', filters.date_from);
      if (filters?.date_to) query = query.lte('created_at', filters.date_to);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((receipt: any) => ({
        ...receipt,
        id: String(receipt.id),
        receipt_image_url: receipt.file_url || publicUrl('receipts', receipt.file_path),
        image_url: receipt.file_url || publicUrl('receipts', receipt.file_path),
        nf_number: receipt.deliveries?.nf_number,
        client_name: receipt.deliveries?.client_name,
        driver_name: receipt.drivers?.name,
        delivered_at: receipt.deliveries?.delivered_at || null,
        scheduled_date: receipt.deliveries?.scheduled_date || null,
      }));
    });
  }

  async getReceiptsReport(filters?: Record<string, string>) {
    return this.run(async () => {
      const response = await this.getCanhotos(filters);
      if (!response.success) throw new Error(response.error);
      return response.data.map((receipt: any) => ({
        id: receipt.delivery_id,
        nf_number: receipt.nf_number || 'N/A',
        client_name_extracted: receipt.client_name || 'Cliente',
        delivery_date: receipt.created_at,
        driver_name: receipt.driver_name || 'Sem motorista',
        receipt_image_url: receipt.receipt_image_url,
        receipt_captured_at: receipt.created_at,
      }));
    });
  }

  async getDeliveryReports(filters?: Record<string, string>) {
    return this.run(async () => {
      const response = await this.getDeliveries(filters);
      if (!response.success) throw new Error(response.error);

      const deliveryIds = response.data.map((delivery) => String(delivery.id));
      const occurrenceByDelivery = new Map<string, any>();
      if (deliveryIds.length > 0) {
        const { data: occurrences, error } = await supabase
          .from('occurrences')
          .select('*, drivers(name)')
          .in('delivery_id', deliveryIds)
          .order('created_at', { ascending: false });
        if (error) throw error;
        (occurrences || []).forEach((occurrence: any) => {
          const key = String(occurrence.delivery_id);
          if (!occurrenceByDelivery.has(key)) {
            occurrenceByDelivery.set(key, {
              ...occurrence,
              driver_name: occurrence.drivers?.name || null,
            });
          }
        });
      }

      return response.data.map((delivery) => {
        const occurrence = occurrenceByDelivery.get(String(delivery.id));
        return {
        id: delivery.id,
        nfNumber: delivery.nf_number,
        nf_number: delivery.nf_number,
        date: delivery.created_at,
        status: delivery.status || 'PENDING',
        volume: delivery.delivery_volume || 1,
        value: asNumber(delivery.merchandise_value, 0),
        driver: delivery.driver_name,
        delivery_address: delivery.delivery_address || delivery.client_address || null,
        client_address: delivery.client_address || delivery.delivery_address || null,
        client_name: delivery.client_name || delivery.client_name_extracted || null,
        receipt_image_url: delivery.receipt_image_url,
        receipt_notes: delivery.receipt_notes || null,
        source_document_url: delivery.source_document_url || null,
        original_delivery_id: delivery.original_delivery_id || null,
        attempt_number: delivery.attempt_number || 1,
        rescheduled_from_occurrence_id: delivery.rescheduled_from_occurrence_id || null,
        latest_occurrence: occurrence || null,
      };
      });
    });
  }

  async processReceiptOCR(receiptId: string | number, ocrData?: { cnpj?: string; clientName?: string; nfNumber?: string; rawText?: string; confidence?: number }) {
    return this.run(async () => {
      const updatePayload: Record<string, any> = {
        status: 'PROCESSED',
        ocr_data: ocrData ? {
          cnpj: ocrData.cnpj || '',
          client_name: ocrData.clientName || '',
          nf_number: ocrData.nfNumber || '',
          raw_text: ocrData.rawText || '',
          confidence: ocrData.confidence || 0,
          processed_at: new Date().toISOString(),
        } : {},
      };

      const { data, error } = await supabase
        .from('delivery_receipts')
        .update(updatePayload)
        .eq('id', String(receiptId))
        .select()
        .single();
      if (error) throw error;

      // Also update the parent delivery with extracted data if available
      if (ocrData?.nfNumber && data.delivery_id) {
        await supabase
          .from('deliveries')
          .update({
            nf_number: ocrData.nfNumber,
            client_name: ocrData.clientName || undefined,
            client_name_extracted: ocrData.clientName || undefined,
          })
          .eq('id', data.delivery_id);
      }

      return {
        ...data,
        id: String(data.id),
        ocr_data: updatePayload.ocr_data,
        status: 'PROCESSED',
      };
    });
  }

  async uploadStandaloneReceipt(file: File, ocrData?: { cnpj?: string; clientName?: string; nfNumber?: string; rawText?: string; confidence?: number }) {
    return this.run(async () => {
      const context = await this.getContext();
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');

      // Try to find a matching delivery by nf_number
      let deliveryId: string | null = null;
      if (ocrData?.nfNumber) {
        const { data: matchedDelivery } = await supabase
          .from('deliveries')
          .select('id')
          .eq('company_id', companyId)
          .eq('nf_number', ocrData.nfNumber)
          .maybeSingle();

        if (matchedDelivery) {
          deliveryId = matchedDelivery.id;
        }
      }

      // Upload file to storage
      const prefix = deliveryId ? `${companyId}/${deliveryId}` : `${companyId}/standalone`;
      const upload = await this.uploadToBucket('receipts', file, prefix);

      // Create receipt record
      const ocrPayload = ocrData ? {
        cnpj: ocrData.cnpj || '',
        client_name: ocrData.clientName || '',
        nf_number: ocrData.nfNumber || '',
        raw_text: ocrData.rawText || '',
        confidence: ocrData.confidence || 0,
        processed_at: new Date().toISOString(),
      } : null;

      const { data, error } = await supabase
        .from('delivery_receipts')
        .insert({
          company_id: companyId,
          delivery_id: deliveryId,
          driver_id: context.driverId || null,
          file_path: upload.path,
          file_url: upload.url,
          filename: file.name,
          status: ocrPayload ? 'PROCESSED' : 'UPLOADED',
          ocr_data: ocrPayload,
        })
        .select()
        .single();
      if (error) throw error;

      // If matched a delivery, update it
      if (deliveryId) {
        const deliveryUpdate: Record<string, any> = {
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
        };
        if (ocrData?.clientName) {
          deliveryUpdate.client_name = ocrData.clientName;
          deliveryUpdate.client_name_extracted = ocrData.clientName;
        }
        await supabase.from('deliveries').update(deliveryUpdate).eq('id', deliveryId);
      }

      return {
        ...data,
        id: String(data.id),
        receipt_image_url: upload.url,
        image_url: upload.url,
        matched_delivery: !!deliveryId,
        delivery_id: deliveryId,
      };
    });
  }

  async validateReceipt(receiptId: string | number, payload: Record<string, any>) {
    return this.run(async () => {
      const { data, error } = await supabase
        .from('delivery_receipts')
        .update({
          ocr_data: payload.ocr_data || payload.corrections || {},
          validated: Boolean(payload.validated),
          status: payload.validated ? 'VALIDATED' : 'UPLOADED',
        })
        .eq('id', String(receiptId))
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  }

  async smartProcessDocument(file: File) {
    return this.run(async () => ({
      extractedData: {},
      rawText: '',
      confidence: null,
      filename: file.name,
      message: 'OCR externo fora do MVP. Preencha ou confirme os dados manualmente.',
    }));
  }

  async extractNfeWithGemini(file: File): Promise<ApiResponse<ExtractedNfeData>> {
    return this.run(async () => {
      const preparedImage = await prepareNfeImageForExtraction(file);

      const { data, error } = await supabase.functions.invoke('extract-nfe-gemini', {
        body: { image_base64: preparedImage.base64, content_type: preparedImage.contentType },
      });

      if (error) {
        let msg = 'Serviço de leitura indisponível no momento.';
        try {
          // FunctionsHttpError has a `context` Response object with the actual body
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          }
        } catch {
          // fallback to generic message
        }
        throw new Error(msg);
      }

      return data as ExtractedNfeData;
    });
  }

  async getSecureFile(url: string): Promise<string | null> {
    return url || null;
  }

  async getOccurrences(filters?: Record<string, string>) {
    return this.run(async () => {
      let query = supabase
        .from('occurrences')
        .select('*, deliveries(nf_number,client_name,scheduled_date), drivers(name)')
        .order('created_at', { ascending: false });

      const ctx = await this.getContext();
      if (ctx.profile.role !== 'MASTER') {
        query = query.eq('company_id', ctx.profile.company_id);
      }

      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.driver_id) query = query.eq('driver_id', filters.driver_id);
      if (filters?.start_date) query = query.gte('created_at', filters.start_date);
      if (filters?.end_date) query = query.lte('created_at', filters.end_date);
      if (filters?.date) {
        const day = filters.date;
        // BRT = UTC-3. Sem o offset, o banco interpreta como UTC e perde ocorrências de noite.
        query = query.gte('created_at', `${day}T00:00:00-03:00`).lte('created_at', `${day}T23:59:59-03:00`);
      }
      if (filters?.delivery_id) query = query.eq('delivery_id', filters.delivery_id);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        photo_url: item.photo_url || publicUrl('receipts', item.photo_path),
        driver_name: item.drivers?.name || 'Motorista',
        client_name: item.deliveries?.client_name || 'Cliente',
        nf_number: item.deliveries?.nf_number || null,
        scheduled_date: item.deliveries?.scheduled_date || null,
        rescheduled_delivery_id: item.rescheduled_delivery_id || null,
        next_scheduled_date: item.next_scheduled_date || null,
      }));
    });
  }

  async createOccurrence(deliveryId: string | number, payload: Record<string, any>) {
    return this.run(async () => {
      const context = await this.getContext();
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');
      if (!context.driverId) {
        throw new Error('Motorista nao vinculado ao cadastro operacional. Avise o administrador antes de sair em rota.');
      }

      let photoPath: string | null = null;
      let photoUrl: string | null = null;
      if (payload.photo instanceof File) {
        const upload = await this.uploadToBucket('receipts', payload.photo, `${companyId}/occurrences`);
        photoPath = upload.path;
        photoUrl = upload.url;
      }

      const { data, error } = await supabase.rpc('report_delivery_occurrence', {
        p_delivery_id: String(deliveryId),
        p_type: payload.type,
        p_description: payload.description,
        p_photo_path: photoPath,
        p_photo_url: photoUrl,
        p_latitude: payload.latitude || null,
        p_longitude: payload.longitude || null,
        p_reschedule: payload.reschedule !== false,
        p_next_scheduled_date: payload.next_scheduled_date || null,
      });
      if (error) throw error;
      return data as ApiDelivery;
    });
  }

  async getDriverPerformanceReports(filters?: { start_date?: string; end_date?: string; driver_id?: string | number }) {
    return this.run(async () => {
      const ctx = await this.getContext();
      let driversQuery = supabase.from('drivers').select('id,name,company_id,current_status').order('name');

      if (ctx.profile.role !== 'MASTER') {
        driversQuery = driversQuery.eq('company_id', ctx.profile.company_id);
      }
      if (filters?.driver_id) {
        driversQuery = driversQuery.eq('id', String(filters.driver_id));
      }

      const { data: drivers, error: driversError } = await driversQuery;
      if (driversError) throw driversError;

      const driverIds = (drivers || []).map((driver) => driver.id);
      if (driverIds.length === 0) return [];

      let deliveriesQuery = supabase
        .from('deliveries')
        .select('id,driver_id,status,scheduled_date')
        .in('driver_id', driverIds);

      if (filters?.start_date) deliveriesQuery = deliveriesQuery.gte('scheduled_date', filters.start_date);
      if (filters?.end_date) deliveriesQuery = deliveriesQuery.lte('scheduled_date', filters.end_date);

      const { data: deliveries, error } = await deliveriesQuery;
      if (error) throw error;

      const byDriver = new Map<string, any[]>();
      (deliveries || []).forEach((delivery: any) => {
        const key = String(delivery.driver_id);
        byDriver.set(key, [...(byDriver.get(key) || []), delivery]);
      });

      return (drivers || []).map((driver: any) => {
        const driverDeliveries = byDriver.get(String(driver.id)) || [];
        return {
          ...driver,
          driver_id: driver.id,
          driver_name: driver.name,
          total_deliveries: driverDeliveries.length,
          completed_deliveries: driverDeliveries.filter((delivery) => delivery.status === 'DELIVERED').length,
          pending_deliveries: driverDeliveries.filter((delivery) => delivery.status === 'PENDING' || delivery.status === 'ASSIGNED').length,
          in_progress_deliveries: driverDeliveries.filter((delivery) => delivery.status === 'IN_TRANSIT').length,
          failed_deliveries: driverDeliveries.filter((delivery) => delivery.status === 'FAILED').length,
          deliveries: driverDeliveries,
        };
      });
    });
  }

  async assignDriver(deliveryId: string | number, driverId: string | number): Promise<ApiResponse<ApiDelivery>> {
    return this.run(async () => {
      const context = await this.getContext();
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');

      const { data, error } = await supabase
        .from('deliveries')
        .update({
          driver_id: String(driverId),
          status: 'ASSIGNED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(deliveryId))
        .select('*, drivers(name), clients(name), delivery_receipts(id,file_path,file_url,filename,status,notes,created_at)')
        .single();

      if (error) throw error;

      // Write event to delivery_events
      await supabase.from('delivery_events').insert({
        company_id: data.company_id || companyId,
        delivery_id: String(deliveryId),
        driver_id: String(driverId),
        event_type: 'ASSIGNED',
        description: 'Motorista atribuído via admin',
      });

      return this.mapDelivery(data);
    });
  }

  async updateDeliveryStatus(
    deliveryId: string,
    newStatus: DeliveryStatus,
    eventType?: string,
    description?: string
  ): Promise<ApiResponse<ApiDelivery>> {
    return this.run(async () => {
      const context = await this.getContext();
      const companyId = context.profile.company_id;
      if (!companyId) throw new Error('Empresa nao identificada.');

      const { data, error } = await supabase
        .from('deliveries')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(deliveryId))
        .select('*, drivers(name), clients(name), delivery_receipts(id,file_path,file_url,filename,status,notes,created_at)')
        .single();

      if (error) throw error;

      // Write event to delivery_events
      await supabase.from('delivery_events').insert({
        company_id: data.company_id || companyId,
        delivery_id: String(deliveryId),
        driver_id: context.driverId || null,
        event_type: eventType || newStatus,
        description: description || null,
      });

      return this.mapDelivery(data);
    });
  }

  async confirmDeliveryLoading(deliveryId: string): Promise<ApiResponse<ApiDelivery>> {
    return this.run(async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .update({
          status: 'ASSIGNED',
          loaded_at: new Date().toISOString(),
        })
        .eq('id', String(deliveryId))
        .select('*, drivers(name), clients(name), delivery_receipts(id,file_path,file_url,filename,status,notes,created_at)')
        .single();

      if (error) throw error;
      return this.mapDelivery(data);
    });
  }

  async startRoute(deliveryIds: string[]): Promise<ApiResponse<{ success: boolean; updated: number }>> {
    return this.run(async () => {
      const { data, error, count } = await supabase
        .from('deliveries')
        .update({ status: 'IN_TRANSIT' })
        .in('id', deliveryIds)
        .select('id');

      if (error) throw error;
      return { success: true, updated: count || data?.length || 0 };
    });
  }

  async deleteDelivery(deliveryId: string | number): Promise<ApiResponse<{ id: string }>> {
    return this.run(async () => {
      const companyId = await this.companyId();
      // Only allow deleting deliveries that haven't been finalized
      const { data: delivery, error: fetchError } = await supabase
        .from('deliveries')
        .select('id, status')
        .eq('id', String(deliveryId))
        .eq('company_id', companyId)
        .single();
      if (fetchError) throw fetchError;
      if (!['PENDING', 'ASSIGNED', 'FAILED'].includes(delivery.status)) {
        throw new Error('Não é possível excluir uma entrega em andamento ou já finalizada.');
      }
      // Remove receipts first (FK)
      await supabase.from('delivery_receipts').delete().eq('delivery_id', String(deliveryId));
      await supabase.from('delivery_events').delete().eq('delivery_id', String(deliveryId));
      const { error } = await supabase.from('deliveries').delete().eq('id', String(deliveryId));
      if (error) throw error;
      return { id: String(deliveryId) };
    });
  }

  async getClients(filters?: { company_id?: string; search?: string }): Promise<ApiResponse<any[]>> {
    return this.run(async () => {
      const companyId = filters?.company_id || (await this.companyId());

      let query = supabase.from('clients').select('*').eq('company_id', String(companyId));

      if (filters?.search) {
        query = query.or(`name.ilike('%${filters.search}%'),email.ilike('%${filters.search}%'),phone.ilike('%${filters.search}%')`);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    });
  }

  async createClient(payload: {
    name: string;
    document?: string;
    email?: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse<any>> {
    return this.run(async () => {
      const companyId = await this.companyId();

      const { data, error } = await supabase
        .from('clients')
        .insert({
          company_id: companyId,
          name: payload.name,
          document: normalizeBrazilianDocument(payload.document),
          email: payload.email || null,
          phone: payload.phone || null,
          address: payload.address || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  async updateClient(clientId: string | number, payload: {
    name?: string;
    document?: string;
    email?: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse<any>> {
    return this.run(async () => {
      const companyId = await this.companyId();

      const { data, error } = await supabase
        .from('clients')
        .update({
          name: payload.name || undefined,
          document: normalizeBrazilianDocument(payload.document) || undefined,
          email: payload.email || undefined,
          phone: payload.phone || undefined,
          address: payload.address || undefined,
        })
        .eq('id', String(clientId))
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }

  async deleteClient(clientId: string | number): Promise<ApiResponse<{ success: boolean }>> {
    return this.run(async () => {
      const companyId = await this.companyId();

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', String(clientId))
        .eq('company_id', companyId);

      if (error) throw error;
      return { success: true };
    });
  }
}

export const apiService = new ApiService();
export default apiService;
