import './App.css'
import React from 'react'
import {Route, Switch} from 'react-router'
import {BrowserRouter} from 'react-router-dom'
import {RbacProvider} from './hooks/useRbac'
import {UsersProvider} from './hooks/useUsers'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './views/Home'
import NewUser from './views/NewUser'
import EditUser from './views/EditUser'
import Namespaces from './components/namespaces'
import RoleManagement from './views/RoleManagement'
import Settings from './views/Settings'
import Permissions from './views/Permissions'
import AccessAudit from './views/AccessAudit'
import Visualizer from './views/Visualizer'

import {SettingsProvider} from './hooks/useSettings'

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <RbacProvider>
          <UsersProvider>
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch'
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <Header />
              </div>

              <div style={{ flexGrow: 1, backgroundColor: '#f5f5f7' }}>
                <Switch>
                  <Route path="/new-user" exact component={NewUser} />
                  <Route path="/users/:username" exact component={EditUser} />
                  <Route path="/namespaces" exact component={Namespaces} />
                  <Route path="/roles" exact component={RoleManagement} />
                  <Route path="/settings" exact component={Settings} />
                  <Route path="/permissions" exact component={Permissions} />
                  <Route path="/audit" exact component={AccessAudit} />
                  <Route path="/visualizer" exact component={Visualizer} />
                  <Route path="/" exact component={Home} />
                </Switch>
              </div>

              <div style={{ flexShrink: 0 }}>
                <Footer />
              </div>
            </div>
          </UsersProvider>
        </RbacProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
