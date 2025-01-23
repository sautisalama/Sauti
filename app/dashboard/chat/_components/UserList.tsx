interface User {
  id: string;
  username: string;
}

interface UserListProps {
  users: User[];
  onUserSelect: (userId: string) => void;
}

export function UserList({ users, onUserSelect }: UserListProps) {
  return (
    <div className="h-full bg-white w-full">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>
      <div className="overflow-y-auto h-[calc(100%-4rem)]">
        {users.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No users available
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
              onClick={() => onUserSelect(user.id)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium">{user.username}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 