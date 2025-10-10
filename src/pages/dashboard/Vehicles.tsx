import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand?: string;
  year?: number;
  color?: string;
  status: string;
  driver_id?: string;
}

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ 
    plate: '', 
    model: '', 
    brand: '',
    year: new Date().getFullYear(),
    color: '',
    status: 'ATIVO' 
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState({ 
    plate: '', 
    model: '', 
    brand: '',
    year: new Date().getFullYear(),
    color: '',
    status: 'ATIVO' 
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    const response = await apiService.getVehicles();
    if (response?.success && response.data) {
      setVehicles(response.data as Vehicle[]);
    } else {
      setError(response?.error || 'Erro ao carregar veículos');
    }
    setLoading(false);
  };

  const handleOpenModal = () => {
    setForm({ 
      plate: '', 
      model: '', 
      brand: '',
      year: new Date().getFullYear(),
      color: '',
      status: 'ATIVO' 
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    if (!form.plate || !form.model) {
      setFormError('Preencha todos os campos obrigatórios.');
      setSaving(false);
      return;
    }
    const response = await apiService.createVehicle({
      plate: form.plate,
      model: form.model,
      brand: form.brand || 'Não informado',
      year: form.year || new Date().getFullYear(),
      color: form.color || 'Não informado'
    });
    if (response?.success && response.data) {
      setShowModal(false);
      fetchVehicles();
    } else {
      setFormError(response?.error || 'Erro ao cadastrar veículo');
    }
    setSaving(false);
  };

  const handleOpenEditModal = (vehicle: Vehicle) => {
    setEditVehicle(vehicle);
    setEditForm({
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand || '',
      year: vehicle.year || new Date().getFullYear(),
      color: vehicle.color || '',
      status: vehicle.status,
    });
    setEditError(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehicle) return;
    setEditSaving(true);
    setEditError(null);
    if (!editForm.plate || !editForm.model) {
      setEditError('Preencha todos os campos obrigatórios.');
      setEditSaving(false);
      return;
    }
    const response = await apiService.updateVehicle(editVehicle.id, editForm);
    if (response?.success && response.data) {
      setEditVehicle(null);
      fetchVehicles();
    } else {
      setEditError(response?.error || 'Erro ao editar veículo');
    }
    setEditSaving(false);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!window.confirm('Tem certeza que deseja excluir este veículo?')) return;
    const response = await apiService.deleteVehicle(vehicle.id);
    if (response?.success) {
      fetchVehicles();
    } else {
      alert(response?.error || 'Erro ao excluir veículo');
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase())
  );

  const PAGE_SIZE = 10;
  const exportToCSV = (data: Vehicle[], filename: string) => {
    if (!data.length) return;
    const csv = [Object.keys(data[0]).join(','), ...data.map(row => Object.values(row).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const [page, setPage] = useState(1);
  const paginatedVehicles = filteredVehicles.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <>
      <div className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Gerenciamento de Veículos</h1>
          <form onSubmit={e => { e.preventDefault(); }} className="flex gap-2">
            <Input
              placeholder="Buscar por placa ou modelo"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
            <Button type="button" onClick={handleOpenModal}>Novo Veículo</Button>
          </form>
        </div>
        {loading ? (
          <p>Carregando veículos...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Veículos Cadastrados</CardTitle>
              <div className="flex gap-2 mt-2">
                <Button type="button" onClick={() => exportToCSV(filteredVehicles, 'veiculos.csv')}>Exportar CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Placa</th>
                      <th className="px-4 py-2 text-left">Modelo</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">{vehicle.plate}</td>
                        <td className="px-4 py-2">{vehicle.model}</td>
                        <td className="px-4 py-2">{vehicle.status}</td>
                        <td className="px-4 py-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenEditModal(vehicle)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(vehicle)}>Excluir</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span>Página {page} de {Math.ceil(filteredVehicles.length / PAGE_SIZE)}</span>
                <Button disabled={page === Math.ceil(filteredVehicles.length / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Veículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="plate" placeholder="Placa" value={form.plate} onChange={handleChange} required className="w-full min-h-[44px] text-base" />
            <Input name="model" placeholder="Modelo" value={form.model} onChange={handleChange} required className="w-full min-h-[44px] text-base" />
            <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded px-3 py-3 min-h-[44px] text-base">
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
            {formError && <p className="text-destructive text-sm">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving} className="w-full min-h-[44px] text-base">Cancelar</Button>
              <Button type="submit" disabled={saving} className="w-full min-h-[44px] text-base">{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editVehicle} onOpenChange={(open) => !open && setEditVehicle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input name="plate" placeholder="Placa" value={editForm.plate} onChange={handleEditChange} required className="w-full min-h-[44px] text-base" />
            <Input name="model" placeholder="Modelo" value={editForm.model} onChange={handleEditChange} required className="w-full min-h-[44px] text-base" />
            <select name="status" value={editForm.status} onChange={handleEditChange} className="w-full border rounded px-3 py-3 min-h-[44px] text-base">
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditVehicle(null)} disabled={editSaving} className="w-full min-h-[44px] text-base">Cancelar</Button>
              <Button type="submit" disabled={editSaving} className="w-full min-h-[44px] text-base">{editSaving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Vehicles; 