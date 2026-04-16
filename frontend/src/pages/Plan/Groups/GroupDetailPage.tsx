import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GroupDetail from './GroupDetail';

const GroupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate('/groups');
  };

  const handleSuccess = () => {
    navigate('/groups');
  };

  return (
    <GroupDetail
      open={true}
      editingId={id}
      mode="view"
      onCancel={handleCancel}
      onSuccess={handleSuccess}
    />
  );
};

export default GroupDetailPage;
