'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skill, SkillLevel } from '@/models/QAAnalyst';
import { X, Plus } from 'lucide-react';

interface SkillsManagerProps {
  skills: Skill[];
  onChange: (skills: Skill[]) => void;
}

const SKILL_AREAS = [
  'Automatización',
  'Testing API',
  'Testing UI',
  'Testing Mobile',
  'Testing de Rendimiento',
  'Testing de Seguridad',
  'SQL',
  'Jira',
  'TestRail',
  'Selenium',
  'Cypress',
  'Postman',
  'JMeter',
  'SonarQube',
  'Git',
];

export function SkillsManager({ skills, onChange }: SkillsManagerProps) {
  const [newSkill, setNewSkill] = useState('');
  const [newLevel, setNewLevel] = useState<SkillLevel>('Intermedio');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSkills, setFilteredSkills] = useState<string[]>([]);

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    
    // Evitar duplicados
    if (skills.some(skill => skill.name.toLowerCase() === newSkill.toLowerCase())) {
      return;
    }
    
    const updatedSkills = [...skills, { name: newSkill, level: newLevel }];
    onChange(updatedSkills);
    setNewSkill('');
    setNewLevel('Intermedio');
    setShowDropdown(false);
  };

  const handleRemoveSkill = (index: number) => {
    const updatedSkills = [...skills];
    updatedSkills.splice(index, 1);
    onChange(updatedSkills);
  };

  const handleSkillInputChange = (value: string) => {
    setNewSkill(value);
    
    if (value.trim()) {
      const filtered = SKILL_AREAS.filter(skill => 
        skill.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSkills(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setShowDropdown(false);
    }
  };

  const selectSkill = (skill: string) => {
    setNewSkill(skill);
    setShowDropdown(false);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {skills.map((skill, index) => (
          <div 
            key={index}
            className={`px-2 py-0.5 rounded-full flex items-center text-xs ${
              skill.level === 'Experto' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
              skill.level === 'Avanzado' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
              skill.level === 'Intermedio' ? 'bg-green-50 text-green-800 border border-green-200' :
              'bg-gray-50 text-gray-800 border border-gray-200'
            }`}
          >
            <span>{skill.name} ({skill.level})</span>
            <button 
              onClick={() => handleRemoveSkill(index)}
              className="ml-1 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="text-xs text-gray-500 italic">
            No hay habilidades registradas
          </div>
        )}
      </div>      <div className="grid grid-cols-6 gap-1.5">
        <div className="relative col-span-4">
          <Input
            value={newSkill}
            onChange={(e) => handleSkillInputChange(e.target.value)}
            placeholder="Buscar habilidad..."
            className="w-full h-8 text-xs"
            onFocus={() => newSkill && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 100)}
          />
          
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-24 overflow-y-auto">
              {filteredSkills.map((skill) => (
                <div
                  key={skill}
                  className="px-2 py-0.5 cursor-pointer hover:bg-blue-50 text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSkill(skill);
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <select
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value as SkillLevel)}
          className="col-span-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="Básico">Básico</option>
          <option value="Intermedio">Intermedio</option>
          <option value="Avanzado">Avanzado</option>
          <option value="Experto">Experto</option>
        </select>
      </div>      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        onClick={handleAddSkill}
        className="mt-1 h-6 text-xs"
        disabled={!newSkill.trim()}
      >
        <Plus className="h-2.5 w-2.5 mr-1" /> Agregar
      </Button>
    </div>
  );
}
