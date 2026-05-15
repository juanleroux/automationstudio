using gTools.Log;
using MyControls;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for SettingsWindow.xaml
    /// </summary>
    public partial class SettingsWindow : WindowBase
    {
        #region Initialization

        private bool _isNavigationPanelExpanded;
        private MainWindow _mainWindow;
        private Project _project;

        public SettingsWindow()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion

        #region Properties

        public MainWindow MainWindow
        {
            get
            {
                return _mainWindow;
            }
            set
            {
                _mainWindow = value;
				_apiSettingsControl.MainWindow = _mainWindow;
				_engineeringSettingsControl.MainWindow = _mainWindow;
			}
        }

        public Project Project
        {
            get
            {
                return _project;
            }
            set
            {
                _project = value;
				_apiSettingsControl.Project = _project;
				_engineeringSettingsControl.Project = _project;
			}
        }

        #endregion

        #region Data Binding

        public bool IsNavigationPanelExpanded
        {
            get
            {
                return _isNavigationPanelExpanded;
            }
            set
            {
                _isNavigationPanelExpanded = value;
                NotifyPropertyChanged("IsNavigationPanelExpanded");
            }
        }

        #endregion

        #region Events

        private void Window_PreviewMouseDown(object sender, MouseButtonEventArgs e)
        {
            try
            {
                //get grid object
                DependencyObject obj = (DependencyObject)e.OriginalSource;
                if (obj.GetType().Namespace.Equals("System.Windows.Documents", StringComparison.OrdinalIgnoreCase))
                    return;

                while (obj != null && (obj is Grid) == false)
                    obj = VisualTreeHelper.GetParent(obj);

                if (obj == null)
                    return;

                //if its navigation grid, do nothing
                if (obj == _navigationGrid)
                    return;

                IsNavigationPanelExpanded = false;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void _tabControl_PreviewMouseRightButtonDown(object sender, MouseButtonEventArgs e)
        {
            try
            {
                //get TabItem object
                DependencyObject obj = (DependencyObject)e.OriginalSource;
                if (obj.GetType().Namespace.Equals("System.Windows.Documents", StringComparison.OrdinalIgnoreCase))
                    return;

                while (obj != null && (obj is TabItem) == false)
                    obj = VisualTreeHelper.GetParent(obj);

                if (obj == null)
                    return;

                (obj as TabItem).Focus();
                e.Handled = true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }


		private void APISettingsMenuItem_Click(object sender, RoutedEventArgs e)
		{
			_tabControl.SelectedIndex = 0;
			IsNavigationPanelExpanded = false;
		}

		private void EngineeringSettingsMenuItem_Click(object sender, RoutedEventArgs e)
		{
			_tabControl.SelectedIndex = 1;
			IsNavigationPanelExpanded = false;
		}

		private void NavigationPanelVisibilityButton_Click(object sender, RoutedEventArgs e)
        {
            IsNavigationPanelExpanded = !IsNavigationPanelExpanded;
        }  

        #endregion
    }
}
