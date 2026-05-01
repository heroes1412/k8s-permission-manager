import React, { useEffect, useState } from 'react'
import CreatableSelect from 'react-select/creatable'
import { httpRequests } from '../services/httpRequests'
import { components } from 'react-select'

interface GroupMultiSelectArguments {
  onSelect(groups: string[]),
  readonly value: string[],
  readonly placeholder: string
}

export default function GroupMultiSelect({onSelect, value, placeholder}: GroupMultiSelectArguments) {
  const [options, setOptions] = useState<{value: string, label: string}[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchGroups = async () => {
    try {
      const { data } = await httpRequests.groupList()
      if (data) {
        setOptions(data.map(g => ({value: g.name, label: g.friendlyName || g.name})))
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const handleDelete = async (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to delete group "${groupName}"?`)) {
      try {
        await httpRequests.groupDelete(groupName)
        await fetchGroups()
        onSelect(value.filter(v => v !== groupName))
      } catch (err) {
        console.error("Failed to delete group", err)
        alert("Failed to delete group")
      }
    }
  }

  const CustomOption = (props: any) => {
    return (
      <components.Option {...props}>
        <div className="flex justify-between items-center">
          <span>{props.data.label}</span>
          <button 
            type="button"
            onClick={(e) => handleDelete(props.data.value, e)}
            className="text-red-500 hover:text-red-700 p-1"
            title="Delete Group"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </components.Option>
    );
  };

  const handleCreate = async (inputValue: string) => {
    const newGroup = inputValue.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    if (newGroup.length < 1 || newGroup.length > 32) {
      alert("Group name must be 1-32 characters long and start/end with an alphanumeric character.");
      return;
    }
    
    setIsLoading(true);
    try {
      await httpRequests.groupCreate(newGroup, []);
      await fetchGroups();
      onSelect([...value, newGroup]);
    } catch (err: any) {
      console.error("Failed to create group", err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      alert(`Failed to create group: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <CreatableSelect
      isClearable
      isDisabled={isLoading}
      isLoading={isLoading}
      value={value.map(g => ({value: g, label: options.find(o => o.value === g)?.label || g}))}
      isMulti
      placeholder={placeholder}
      options={options}
      onChange={vs => {
        if (!vs) {
          onSelect([])
          return
        }
        onSelect(vs.map(x => x.value))
      }}
      onCreateOption={handleCreate}
      components={{ Option: CustomOption }}
      styles={{
        control: (base, state) => ({
          ...base,
          border: state.isFocused ? '2px solid #0071e3' : '2px solid rgba(0, 0, 0, 0.04)',
          borderRadius: '11px',
          padding: '4px',
          boxShadow: 'none',
          backgroundColor: '#fafafc',
          '&:hover': {
            borderColor: state.isFocused ? '#0071e3' : 'rgba(0, 0, 0, 0.1)',
          }
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isSelected ? '#0071e3' : state.isFocused ? '#f5f5f7' : 'transparent',
          color: state.isSelected ? 'white' : 'rgba(0, 0, 0, 0.8)',
          cursor: 'pointer',
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: '#f5f5f7',
          borderRadius: '5px',
        }),
        multiValueLabel: (base) => ({
          ...base,
          color: '#1d1d1f',
        }),
        multiValueRemove: (base) => ({
          ...base,
          color: 'rgba(0, 0, 0, 0.48)',
          ':hover': {
            backgroundColor: '#ff3b30',
            color: 'white',
          },
        }),
      }}
    />
  )
}
