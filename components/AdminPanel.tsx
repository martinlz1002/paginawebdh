import AdminCarrerasForm from './AdminCarrerasForm';
import VerCompetidores from './VerCompetidores';

const AdminPanel = () => {
  return (
    <div className="admin-panel">
      <AdminCarrerasForm />    {/* Componente para agregar carreras */}
      <VerCompetidores />      {/* Componente para ver los competidores inscritos */}
    </div>
  );
};

export default AdminPanel;