"use client";

import { Project } from '@/models/Project';
import { QAAnalyst } from '@/models/QAAnalyst';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { TimelineView } from './TimelineView/TimelineView';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { getJiraUrl } from '@/utils/jiraUtils';
import { ChangeProjectStatusDialog } from './projects/ChangeProjectStatusDialog';
import { useProjects, useProjectStats, createProject, updateProject, deleteProject, changeProjectStatus } from '@/hooks/useProjects';

const HOURS_PER_DAY = 9;

interface FormErrors {
    [key: string]: string;
}

export default function ProjectTable() {    // Usar hook personalizado SWR para proyectos
    const { projects, isLoading: isLoadingProjects, isError: isErrorProjects } = useProjects();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [newProject, setNewProject] = useState<Partial<Project>>({});
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
    const [cells, setCells] = useState<{ id: string; name: string; teamId: string }[]>([]);
    const [analysts, setAnalysts] = useState<QAAnalyst[]>([]);
    const [filteredCells, setFilteredCells] = useState<{ id: string; name: string; teamId: string }[]>([]);
    const [activeView, setActiveView] = useState<'table' | 'timeline'>('table');
    const [sortConfig, setSortConfig] = useState<{
        key: keyof Project | null;
        direction: 'asc' | 'desc';
    }>({ key: null, direction: 'asc' });
    const [filterEquipo, setFilterEquipo] = useState<string>('');
    const [filterAnalista, setFilterAnalista] = useState<string>('');
    // Estados para el cambio de estado del proyecto
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [projectToChangeStatus, setProjectToChangeStatus] = useState<Project | null>(null);
    const [selectedDateFilter, setSelectedDateFilter] = useState<'week' | 'month' | 'year' | 'custom'>('month');
    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [endDate, setEndDate] = useState<Date | null>(null);    useEffect(() => {
        // Ya no necesitamos cargar los proyectos manualmente
        fetchTeams();
        fetchCells();
        fetchAnalysts();
    }, []);

    useEffect(() => {
        if (newProject.horas) {
            setNewProject(prev => ({
                ...prev,
                dias: Math.ceil(prev.horas! / HOURS_PER_DAY)
            }));
        }
    }, [newProject.horas]);

    useEffect(() => {
        if (newProject.fechaEntrega && newProject.fechaRealEntrega) {
            const entrega = new Date(newProject.fechaEntrega);
            const realEntrega = new Date(newProject.fechaRealEntrega);
            const diffTime = realEntrega.getTime() - entrega.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setNewProject(prev => ({
                ...prev,
                diasRetraso: Math.max(0, diffDays)
            }));
        }
    }, [newProject.fechaEntrega, newProject.fechaRealEntrega]);

    useEffect(() => {
        if (newProject.equipo) {
            setFilteredCells(cells.filter(cell => {
                const team = teams.find(t => t.name === newProject.equipo);
                return team ? cell.teamId === team.id : false;
            }));
        } else {
            setFilteredCells([]);
        }
    }, [newProject.equipo, cells, teams]);

    useEffect(() => {
        const today = new Date();
        let start: Date;
        let end: Date;

        switch (selectedDateFilter) {
            case 'week':
                // Inicio de la semana actual (lunes)
                start = new Date(today);
                start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                break;
            case 'year':
                // Inicio del año actual
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
            case 'month':
            default:
                // Inicio del mes actual
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
        }

        setStartDate(start);
        setEndDate(end);
    }, [selectedDateFilter]);      // La función loadProjects ya no es necesaria porque usamos el hook useProjects

    const fetchTeams = async () => {
        try {
            const response = await fetch('/api/teams');
            const data = await response.json();
            setTeams(data);
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const fetchCells = async () => {
        try {
            const response = await fetch('/api/cells');
            const data = await response.json();
            setCells(data);
        } catch (error) {
            console.error('Error fetching cells:', error);
        }
    };

    const fetchAnalysts = async () => {
        try {
            const response = await fetch('/api/analysts');
            const data = await response.json();
            setAnalysts(data);
        } catch (error) {
            console.error('Error fetching analysts:', error);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!newProject.idJira?.trim()) {
            newErrors.idJira = 'El ID de Jira es requerido';
        } else if (!/^[A-Z]+-\d+$/.test(newProject.idJira)) {
            newErrors.idJira = 'Formato inválido. Debe ser como "PROJ-123"';
        }

        if (!newProject.proyecto?.trim()) {
            newErrors.proyecto = 'El nombre del proyecto es requerido';
        }

        if (!newProject.equipo?.trim()) {
            newErrors.equipo = 'El equipo es requerido';
        }

        if (!newProject.celula?.trim()) {
            newErrors.celula = 'La célula es requerida';
        }

        if (!newProject.horas || newProject.horas <= 0) {
            newErrors.horas = 'Las horas deben ser mayores a 0';
        }

        if (!newProject.fechaEntrega) {
            newErrors.fechaEntrega = 'La fecha de entrega es requerida';
        }

        if (!newProject.analistaProducto?.trim()) {
            newErrors.analistaProducto = 'El analista de producto es requerido';
        }

        if (!newProject.planTrabajo?.trim()) {
            newErrors.planTrabajo = 'El plan de trabajo es requerido';
        }

        if (newProject.fechaRealEntrega && newProject.fechaCertificacion) {
            const realEntrega = new Date(newProject.fechaRealEntrega);
            const certificacion = new Date(newProject.fechaCertificacion);

            if (certificacion < realEntrega) {
                newErrors.fechaCertificacion = 'La fecha de certificación no puede ser anterior a la fecha real de entrega';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };    const handleDelete = async (idJira: string) => {
        try {
            // Utilizamos la función del hook que incluye todas las notificaciones
            await deleteProject(idJira);
        } catch (error) {
            console.error('Error al eliminar el proyecto:', error);
        }
    };    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        
        // Verificar que idJira no sea nulo para ediciones
        if (editingProject && (!newProject.idJira || !editingProject.idJira)) {
            toast.error('Error: No se encontró el ID de Jira para actualizar el proyecto');
            return;
        }

        try {
            setIsSubmitting(true);
            
            if (editingProject && editingProject.idJira) {
                // Actualizar proyecto existente usando idJira como identificador único
                await updateProject(editingProject.idJira, newProject);
            } else {
                // Crear nuevo proyecto
                await createProject(newProject);
            }
            
            // Cerrar el formulario y resetear
            setShowForm(false);
            setEditingProject(null);
            resetForm();
        } catch (error) {
            console.error('Error al guardar el proyecto:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setNewProject({});
        setErrors({});
    };
      const sortData = (data: Project[]) => {
        if (!sortConfig.key) return data;

        return [...data].sort((a, b) => {
            // Añadir lógica para manejar el botón de cambio de estado
            if (!a || !b) return 0;
            
            const key = sortConfig.key as keyof Project;
            
            // Obtener valores seguros (usando nullish coalescing)
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';
            
            // Lógica especial para fechas
            if (key === 'fechaEntrega' || key === 'fechaRealEntrega' || key === 'fechaCertificacion') {
                const dateA = valA ? new Date(valA as string).getTime() : 0;
                const dateB = valB ? new Date(valB as string).getTime() : 0;
                return sortConfig.direction === 'asc'
                    ? dateA - dateB
                    : dateB - dateA;
            } 
            
            // Si son strings, hacer comparación de strings
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortConfig.direction === 'asc' 
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }
            
            // Para otros tipos, comparación genérica
            return sortConfig.direction === 'asc'
                ? (valA < valB ? -1 : valA > valB ? 1 : 0)
                : (valA > valB ? -1 : valA < valB ? 1 : 0);
        });
    };

    const requestSort = (key: keyof Project) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key: keyof Project) => {
        if (sortConfig.key !== key) return <ChevronsUpDown className="h-4 w-4 inline-block ml-1" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="h-4 w-4 inline-block ml-1 text-blue-600" />
            : <ChevronDown className="h-4 w-4 inline-block ml-1 text-blue-600" />;
    };

    // Función helper para formatear fechas
    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'UTC'
        });
    };
    
    const renderJiraId = (idJira: string | null | undefined) => {
        if (!idJira) return '';  // Manejar caso donde idJira sea nulo o indefinido
        
        const jiraUrl = getJiraUrl(idJira);
        if (!jiraUrl) return idJira;

        return (
            <a
                href={jiraUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
            >
                {idJira}
            </a>
        );
    };
    
    // Funciones para manejar el diálogo de cambio de estado
    const openStatusDialog = (project: Project) => {
        setProjectToChangeStatus(project);
        setStatusDialogOpen(true);
    };
    
    const closeStatusDialog = () => {
        setStatusDialogOpen(false);
        setProjectToChangeStatus(null);
    };

    const filteredProjects = sortData(projects.filter(project => {
        // Comprobar que las propiedades existan antes de acceder a ellas
        const matchesSearch =
            (project.idJira?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (project.proyecto?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (project.equipo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (project.analistaProducto?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        const matchesEquipo = !filterEquipo || project.equipo === filterEquipo;
        const matchesAnalista = !filterAnalista || project.analistaProducto === filterAnalista;
        
        // Filtrar por fecha (verificar si la fecha existe)
        const projectDate = project.fechaEntrega ? new Date(project.fechaEntrega) : null;
        const matchesDate = projectDate ? (projectDate >= startDate && (!endDate || projectDate <= endDate)) : false;

        return matchesSearch && matchesEquipo && matchesAnalista && matchesDate;
    }));
    
    const equipos = Array.from(new Set(projects.map(p => p.equipo || '').filter(Boolean)));
    const analistas = Array.from(new Set(projects.map(p => p.analistaProducto || '').filter(Boolean)));

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex space-x-2">
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        onClick={() => setShowForm(true)}
                    >
                        Nuevo Proyecto
                    </button>
                    <div className="flex rounded-lg overflow-hidden border">
                        <button
                            className={`px-4 py-2 transition-colors ${
                                activeView === 'table'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            onClick={() => setActiveView('table')}
                        >
                            Vista Tabla
                        </button>
                        <button
                            className={`px-4 py-2 transition-colors ${
                                activeView === 'timeline'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            onClick={() => setActiveView('timeline')}
                        >
                            Vista Calendario
                        </button>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    {/* Filtros de fecha */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedDateFilter('week')}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                selectedDateFilter === 'week'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                        >
                            Semana actual
                        </button>
                        <button
                            onClick={() => setSelectedDateFilter('month')}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                selectedDateFilter === 'month'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                        >
                            Mes actual
                        </button>
                        <button
                            onClick={() => setSelectedDateFilter('year')}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                selectedDateFilter === 'year'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                        >
                            Año actual
                        </button>
                    </div>

                    {/* Separador */}
                    <div className="w-px h-8 bg-gray-300"></div>

                    {/* Filtros existentes */}
                    <select
                        className="border rounded px-3 py-2"
                        value={filterEquipo}
                        onChange={(e) => setFilterEquipo(e.target.value)}
                    >
                        <option value="">Todos los equipos</option>
                        {equipos.map(equipo => (
                            <option key={equipo} value={equipo}>{equipo}</option>
                        ))}
                    </select>
                    <select
                        className="border rounded px-3 py-2"
                        value={filterAnalista}
                        onChange={(e) => setFilterAnalista(e.target.value)}
                    >
                        <option value="">Todos los analistas</option>
                        {analistas.map(analista => (
                            <option key={analista} value={analista}>{analista}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Buscar proyecto..."
                        className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-lg shadow-lg space-y-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">{editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* ID Jira */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    ID Jira
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    placeholder="Ej: PROJ-123"
                                    pattern="[A-Z]+-[0-9]+"
                                    className={`border p-2 rounded w-full ${errors.idJira ? 'border-red-500' : ''}`}
                                    value={newProject.idJira || ''}
                                    onChange={(e) => {
                                        setNewProject({ ...newProject, idJira: e.target.value.toUpperCase() });
                                        if (errors.idJira) {
                                            setErrors({ ...errors, idJira: '' });
                                        }
                                    }}
                                    required
                                />
                                {errors.idJira && <p className="text-red-500 text-sm">{errors.idJira}</p>}
                            </div>

                            {/* Proyecto */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Proyecto
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    placeholder="Nombre del proyecto"
                                    className={`border p-2 rounded w-full ${errors.proyecto ? 'border-red-500' : ''}`}
                                    value={newProject.proyecto || ''}
                                    onChange={(e) => {
                                        setNewProject({ ...newProject, proyecto: e.target.value });
                                        if (errors.proyecto) setErrors({ ...errors, proyecto: '' });
                                    }}
                                    required
                                />
                                {errors.proyecto && <p className="text-red-500 text-sm">{errors.proyecto}</p>}
                            </div>

                            {/* Equipo */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Equipo
                                    <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className={`border p-2 rounded w-full ${errors.equipo ? 'border-red-500' : ''}`}
                                    value={newProject.equipo || ''}
                                    onChange={(e) => {
                                        setNewProject(prev => ({
                                            ...prev,
                                            equipo: e.target.value,
                                            celula: '' // Reset célula when team changes
                                        }));
                                        if (errors.equipo) setErrors({ ...errors, equipo: '' });
                                    }}
                                    required
                                >
                                    <option value="">Seleccionar equipo</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.name}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.equipo && <p className="text-red-500 text-sm">{errors.equipo}</p>}
                            </div>

                            {/* Célula */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Célula
                                    <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className={`border p-2 rounded w-full ${errors.celula ? 'border-red-500' : ''}`}
                                    value={newProject.celula || ''}
                                    onChange={(e) => {
                                        setNewProject({ ...newProject, celula: e.target.value });
                                        if (errors.celula) setErrors({ ...errors, celula: '' });
                                    }}
                                    required
                                    disabled={!newProject.equipo} // Disable if no team is selected
                                >
                                    <option value="">Seleccionar célula</option>
                                    {filteredCells.map(cell => (
                                        <option key={cell.id} value={cell.name}>
                                            {cell.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.celula && <p className="text-red-500 text-sm">{errors.celula}</p>}
                                {!newProject.equipo && (
                                    <p className="text-sm text-gray-500">Selecciona un equipo primero</p>
                                )}
                            </div>

                            {/* Horas */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Horas
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Número de horas"
                                    className={`border p-2 rounded w-full ${errors.horas ? 'border-red-500' : ''}`}
                                    value={newProject.horas || ''}
                                    onChange={(e) => {
                                        const hours = parseInt(e.target.value);
                                        setNewProject({ ...newProject, horas: hours });
                                        if (errors.horas) setErrors({ ...errors, horas: '' });
                                    }}
                                    required
                                />
                                {errors.horas && <p className="text-red-500 text-sm">{errors.horas}</p>}
                                <p className="text-sm text-gray-500">Las horas se convertirán automáticamente a días (9 horas = 1 día)</p>
                            </div>

                            {/* Días (calculado automáticamente) */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Días (Automático)</label>
                                <input
                                    type="number"
                                    placeholder="Días calculados"
                                    className="border p-2 rounded w-full bg-gray-100"
                                    value={newProject.dias || ''}
                                    readOnly
                                />
                            </div>

                            {/* Fecha Entrega */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Fecha de Entrega Planificada
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    className={`border p-2 rounded w-full ${errors.fechaEntrega ? 'border-red-500' : ''}`}
                                    value={newProject.fechaEntrega ? new Date(newProject.fechaEntrega).toISOString().split('T')[0] : ''}
                                    onChange={(e) => {
                                        setNewProject({ ...newProject, fechaEntrega: new Date(e.target.value) });
                                        if (errors.fechaEntrega) setErrors({ ...errors, fechaEntrega: '' });
                                    }}
                                    required
                                />
                                {errors.fechaEntrega && <p className="text-red-500 text-sm">{errors.fechaEntrega}</p>}
                            </div>

                            {/* Fecha Real Entrega */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Fecha Real de Entrega</label>
                                <input
                                    type="date"
                                    className={`border p-2 rounded w-full ${errors.fechaRealEntrega ? 'border-red-500' : ''}`}
                                    value={newProject.fechaRealEntrega ? new Date(newProject.fechaRealEntrega).toISOString().split('T')[0] : ''}
                                    onChange={(e) => {
                                        const date = e.target.value ? new Date(e.target.value) : null;
                                        setNewProject({ ...newProject, fechaRealEntrega: date || undefined });
                                        if (errors.fechaRealEntrega) setErrors({ ...errors, fechaRealEntrega: '' });
                                    }}
                                />
                                {errors.fechaRealEntrega && <p className="text-red-500 text-sm">{errors.fechaRealEntrega}</p>}
                            </div>

                            {/* Fecha Certificación */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Fecha de Certificación</label>
                                <input
                                    type="date"
                                    className={`border p-2 rounded w-full ${errors.fechaCertificacion ? 'border-red-500' : ''}`}
                                    value={newProject.fechaCertificacion ? new Date(newProject.fechaCertificacion).toISOString().split('T')[0] : ''}
                                    onChange={(e) => {
                                        const date = e.target.value ? new Date(e.target.value) : null;
                                        setNewProject({ ...newProject, fechaCertificacion: date || undefined });
                                        if (errors.fechaCertificacion) setErrors({ ...errors, fechaCertificacion: '' });
                                    }}
                                />
                                {errors.fechaCertificacion && <p className="text-red-500 text-sm">{errors.fechaCertificacion}</p>}
                            </div>
                            
                            {/* Días de Retraso (calculado automáticamente) */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Días de Retraso (Automático)</label>
                                <input
                                    type="number"
                                    placeholder="Días de retraso"
                                    className="border p-2 rounded w-full bg-gray-100"
                                    value={newProject.diasRetraso || 0}
                                    readOnly
                                />
                            </div>
                            
                            {/* Estado del proyecto */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Estado del Proyecto</label>
                                <select
                                    className="border p-2 rounded w-full"
                                    value={newProject.estadoCalculado || ''}
                                    onChange={(e) => {
                                        setNewProject({ 
                                            ...newProject, 
                                            estadoCalculado: e.target.value as 'Por Iniciar' | 'En Progreso' | 'Certificado' 
                                        });
                                        
                                        // Si se marca como certificado y no tiene fecha de certificación, establecerla automáticamente
                                        if (e.target.value === 'Certificado' && !newProject.fechaCertificacion) {
                                            setNewProject(prev => ({ 
                                                ...prev, 
                                                fechaCertificacion: new Date() 
                                            }));
                                        }
                                    }}
                                >
                                    <option value="">Seleccionar estado</option>
                                    <option value="Por Iniciar">Por Iniciar</option>
                                    <option value="En Progreso">En Progreso</option>
                                    <option value="Certificado">Certificado</option>
                                </select>
                                <p className="text-sm text-gray-500">
                                    El estado se calcula automáticamente según las fechas, pero puede modificarse manualmente.
                                </p>
                            </div>

                            {/* Analista Producto */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Analista de Producto
                                    <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className={`border p-2 rounded w-full ${errors.analistaProducto ? 'border-red-500' : ''}`}
                                    value={newProject.analistaProducto || ''}
                                    onChange={(e) => {
                                        setNewProject({ ...newProject, analistaProducto: e.target.value });
                                        if (errors.analistaProducto) setErrors({ ...errors, analistaProducto: '' });
                                    }}
                                    required
                                >
                                    <option value="">Seleccionar analista</option>
                                    {analysts.map(analyst => (
                                        <option key={analyst.id} value={analyst.name}>
                                            {analyst.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.analistaProducto && <p className="text-red-500 text-sm">{errors.analistaProducto}</p>}
                            </div>

                            {/* Plan de Trabajo */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Plan de Trabajo
                                    <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    placeholder="Descripción del plan de trabajo"
                                    className={`border p-2 rounded w-full h-24 ${errors.planTrabajo ? 'border-red-500' : ''}`}
                                    value={newProject.planTrabajo || ''}
                                    onChange={(e) => {
                                        setNewProject({ ...newProject, planTrabajo: e.target.value });
                                        if (errors.planTrabajo) setErrors({ ...errors, planTrabajo: '' });
                                    }}
                                    required
                                />
                                {errors.planTrabajo && <p className="text-red-500 text-sm">{errors.planTrabajo}</p>}
                            </div>

                            <div className="flex justify-end space-x-2">                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingProject(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Guardando...
                                        </>
                                    ) : (
                                        editingProject ? 'Actualizar' : 'Guardar'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}            {isLoadingProjects ? (
                <div className="flex justify-center items-center p-8">
                    <div className="flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-gray-600">Cargando proyectos...</p>
                    </div>
                </div>
            ) : isErrorProjects ? (
                <div className="flex justify-center items-center p-8 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex flex-col items-center text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-red-800 font-medium">Error al cargar los proyectos</p>
                        <p className="text-red-600 mt-1">Por favor, intente nuevamente más tarde</p>
                    </div>
                </div>
            ) : activeView === 'timeline' ? (
                <TimelineView
                    projects={filteredProjects}
                    analysts={analysts}
                    filterAnalista={filterAnalista}
                    filterEquipo={filterEquipo}
                />
            ) : (
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full">
<thead><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Id Jira</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Proyecto</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Equipo</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Celula</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Horas</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Días</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100 group min-w-[140px]" onClick={() => requestSort('fechaEntrega')}><div className="flex items-center"><span className="mr-1">Fecha Entrega</span>{getSortIcon('fechaEntrega')}</div></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100 group min-w-[140px]" onClick={() => requestSort('fechaRealEntrega')}><div className="flex items-center"><span className="mr-1">Fecha Real</span>{getSortIcon('fechaRealEntrega')}</div></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100 group min-w-[140px]" onClick={() => requestSort('fechaCertificacion')}><div className="flex items-center"><span className="mr-1">Certificación</span>{getSortIcon('fechaCertificacion')}</div></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100 group min-w-[140px]" onClick={() => requestSort('diasRetraso')}><div className="flex items-center"><span className="mr-1">Días Retraso</span>{getSortIcon('diasRetraso')}</div></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Analista QA</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100 group min-w-[140px]" onClick={() => requestSort('estadoCalculado')}><div className="flex items-center"><span className="mr-1">Estado</span>{getSortIcon('estadoCalculado')}</div></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Plan de Trabajo</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Acciones</th></tr></thead>
<tbody className="bg-white divide-y divide-gray-200">
{filteredProjects.length === 0 ? (
    <tr>
        <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
            <p className="text-lg font-medium mb-2">No hay proyectos que coincidan con los criterios de búsqueda</p>
            <p className="text-sm">Intenta ajustar los filtros o crear un nuevo proyecto</p>
        </td>
    </tr>
) : filteredProjects.filter(project => project && project.idJira).map((project, index) => (
<tr key={index} className="hover:bg-gray-50 transition-colors"><td className="px-4 py-2 text-sm font-medium text-blue-600 whitespace-nowrap">{renderJiraId(project.idJira)}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.proyecto || ''}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.equipo || ''}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.celula || ''}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.horas || 0}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.dias || 0}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.fechaEntrega && (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{formatDate(project.fechaEntrega)}</span>)}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.fechaRealEntrega && (<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.diasRetraso > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{formatDate(project.fechaRealEntrega)}</span>)}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.fechaCertificacion && (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{formatDate(project.fechaCertificacion)}</span>)}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.diasRetraso || 0}</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.analistaProducto || ''}</td><td className="px-4 py-2 text-sm text-gray-900">
    <div className="flex flex-col items-start">
        {project.estadoCalculado ? (
            <span 
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 ${
                    project.estadoCalculado === 'Por Iniciar' 
                        ? 'bg-amber-100 text-amber-800' 
                        : project.estadoCalculado === 'En Progreso' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                }`}
                onClick={() => openStatusDialog(project)}
            >
                {project.estadoCalculado}
            </span>
        ) : (
            <span 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:opacity-80"
                onClick={() => openStatusDialog(project)}
            >
                Sin estado
            </span>
        )}
    </div>
</td><td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{project.planTrabajo || ''}</td><td className="px-4 py-2 text-sm whitespace-nowrap"><button onClick={() => {if (!project.idJira) {toast.error('No se puede editar un proyecto sin ID de Jira');return;}setEditingProject(project);setNewProject(project);setShowForm(true);}} className="text-blue-600 hover:text-blue-800 mr-2">Editar</button><button onClick={() => {if (!project.idJira) {toast.error('No se puede eliminar un proyecto sin ID de Jira');return;}toast.info('¿Estás seguro?', {action: {label: 'Eliminar',onClick: () => handleDelete(project.idJira)},description: 'Esta acción no se puede deshacer',cancel: {label: 'Cancelar'}});}} className="text-red-600 hover:text-red-800">Eliminar</button></td></tr>
))}
</tbody>
                    </table>
                </div>
            )}
              {/* Diálogo de cambio de estado */}
            {statusDialogOpen && projectToChangeStatus && (
                <ChangeProjectStatusDialog
                    project={projectToChangeStatus}
                    isOpen={statusDialogOpen}
                    onClose={closeStatusDialog}
                />
            )}
        </div>
    );
}
