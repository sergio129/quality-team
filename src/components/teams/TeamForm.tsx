'use client';

import { Team } from "@/models/Team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createTeam, updateTeam, TeamFormData as TeamData } from "@/hooks/useTeams";
import { toast } from "sonner";

// Definir el esquema de validación con zod
const teamSchema = z.object({
  name: z.string()
    .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
    .max(50, { message: 'El nombre no puede exceder 50 caracteres' }),
  description: z.string()
    .max(500, { message: 'La descripción no puede exceder 500 caracteres' })
    .optional()
    .nullable()
});

// Tipo inferido desde el esquema zod
type TeamFormData = z.infer<typeof teamSchema>;

interface TeamFormProps {
  team?: Team;
  onSave?: () => void;
  onSuccess?: () => void;
}

export function TeamForm({ team, onSave, onSuccess }: TeamFormProps) {
  const router = useRouter();
  
  // Configurar react-hook-form con zod
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting },
    reset
  } = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: team?.name || '',
      description: team?.description || ''
    }
  });
  
  const onSubmit = async (data: TeamFormData) => {
    try {
      if (team) {
        // Asegurarnos que los tipos coincidan para updateTeam
        await updateTeam(team.id, {
          name: data.name,
          description: data.description === null ? undefined : data.description
        });
      } else {
        // Asegurarnos que los tipos coincidan para createTeam
        await createTeam({
          name: data.name,
          description: data.description === null ? undefined : data.description
        });
        // Resetear el formulario después de un envío exitoso (solo para nuevos equipos)
        reset();
      }
      
      // Callback adicional si es necesario
      if (onSave) {
        onSave();
      } else {
        router.refresh();
      }

      // Cerrar el diálogo usando el callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error al guardar el equipo:", error);
      toast.error("Ha ocurrido un error al guardar el equipo");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className={errors.name ? 'text-destructive' : ''}>
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Ingrese el nombre del equipo"
          {...register('name')}
          className={errors.name ? 'border-destructive' : ''}
          aria-invalid={errors.name ? 'true' : 'false'}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description" className={errors.description ? 'text-destructive' : ''}>
          Descripción
        </Label>
        <Textarea
          id="description"
          placeholder="Ingrese la descripción del equipo"
          {...register('description')}
          className={errors.description ? 'border-destructive' : ''}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : team ? 'Guardar Cambios' : 'Crear Equipo'}
      </Button>
    </form>
  );
}
