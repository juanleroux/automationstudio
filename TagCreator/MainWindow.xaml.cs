using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
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
using System.Windows.Navigation;
using System.Windows.Shapes;
using gTools.Log;
using System.ComponentModel;
using System.IO;
using System.Globalization;
using System.Reflection;
using MyControls;
using System.Diagnostics;
using System.Net.Mail;
using System.Net.Mime;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : WindowBase
    {
        #region Initialization

        private Project _project = null;
        private Configuration _configuration = null;
        private bool _isNavigationPanelExpanded;
        public const int TabPageEngineeringView = 0;
        //public const int TabPageProposalView = 1;
        public const int TabPageModelView = 1;

        public MainWindow()
        {
            InitializeComponent();

            //set wpf data context
            this.DataContext = this;

            //pass class handle
            _engineeringViewControl.MainWindow = this;
            _modelViewControl.MainWindow = this;

            //load config
            _configuration = Configuration.Load("app.cfg");            

#if DEBUG
            string testPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "test.xml");
            if (System.IO.File.Exists(testPath))
            {
                LoadProject(testPath);
                //_tabControl.SelectedIndex = TabPageModelView;
            }
#endif
            
            ResetDataBinding();            
        }

        #endregion

        #region Properties

        public Configuration Configuration
        {
            get
            {
                return _configuration;
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

        public bool IsProjectLoaded
        {
            get
            {
                return _project != null;
            }
        }        

        #endregion

        #region Events

        private void FileSaveMenuItem_Click(object sender, RoutedEventArgs e)
        {
            _project.Save();
            IsNavigationPanelExpanded = false;
        }

        private void SettingsMenuItem_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                SettingsWindow window = new SettingsWindow();
                window.Owner = this;
                window.MainWindow = this;
                window.Project = _project;

                window.ShowDialog();

                _engineeringViewControl.NotifyPropertyChanged("IsFolderSet");
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }

            IsNavigationPanelExpanded = false;
        }

        private void AboutMenuItem_Click(object sender, RoutedEventArgs e)
        {            
            IsNavigationPanelExpanded = false;
        }

        private void FileCloseMenuItem_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private void FileNewProjectMenuItem_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Microsoft.Win32.SaveFileDialog saveFileDialog = new Microsoft.Win32.SaveFileDialog();
                saveFileDialog.Filter = "XML Files (*.xml)|*.xml";

                if (saveFileDialog.ShowDialog(this) != true)
                    return;

                _engineeringViewControl.RemoveProfileTabPages();

                _project = new Project();                
                _engineeringViewControl.Project = _project;
                _modelViewControl.Project = _project;
                _project.FilePath = saveFileDialog.FileName;

                //add unasigned are
                _project.Areas.AddArea(new Area() {Name = "Unassigned"}, 0);

                //copy proposal client details
                _project.Proposal.ClientDetails.Address = Configuration.Proposal.Address;
                _project.Proposal.ClientDetails.CompanyName = Configuration.Proposal.CompanyName;
                _project.Proposal.ClientDetails.ContactName = Configuration.Proposal.ContactName;
                _project.Proposal.ClientDetails.Description = Configuration.Proposal.Description;
                _project.Proposal.ClientDetails.EmailAddress = Configuration.Proposal.EmailAddress;
                _project.Proposal.ClientDetails.LogoFilePath = Configuration.Proposal.LogoFilePath;
                _project.Proposal.ClientDetails.PhoneNumber = Configuration.Proposal.PhoneNumber;
                _project.Proposal.ClientDetails.TaxNumber = Configuration.Proposal.TaxNumber;                

                ResetDataBinding();                
                IsNavigationPanelExpanded = false;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void FileOpenMenuItem_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Microsoft.Win32.OpenFileDialog openFileDialog = new Microsoft.Win32.OpenFileDialog();
                openFileDialog.Filter = "XML Files (*.xml)|*.xml";

                if (openFileDialog.ShowDialog(this) != true)
                    return;

                LoadProject(openFileDialog.FileName);
                ResetDataBinding();                
                IsNavigationPanelExpanded = false;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void NavigationPanelVisibilityButton_Click(object sender, RoutedEventArgs e)
        {
            IsNavigationPanelExpanded = !IsNavigationPanelExpanded;            
        }               

        private void ProposalViewMenuItem_Click(object sender, RoutedEventArgs e)
        {
            //_tabControl.SelectedIndex = TabPageProposalView;
            IsNavigationPanelExpanded = false;
        }
        
        private void EngineeringViewMenuItem_Click(object sender, RoutedEventArgs e)
        {
            _tabControl.SelectedIndex = TabPageEngineeringView;
            IsNavigationPanelExpanded = false;
        }        

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

        #endregion

        #region Methods        

        public bool? Confirm(string format, params object[] arg)
        {
            QuestionWindow window = new QuestionWindow();
            window.Owner = this;
            window.Message = string.Format(format, arg);

            return window.ShowDialog();
        }

        public void ShowAutoMessage(int interval, string format, params object[] arg)
        {
            AutoMessageWindow window = new AutoMessageWindow();
            window.Owner = this;
            window.Message = string.Format(format, arg);
            window.Interval = new TimeSpan(0, 0, 0, 0, interval);
            window.ShowDialog();
        }

        public void ShowMessage(string format, params object[] arg)
        {
            MessageWindow window = new MessageWindow();
            window.Owner = this;
            window.Message = string.Format(format, arg);

            window.ShowDialog();
        }

        private void LoadProject(string filePath)
        {
            try
            {
                _engineeringViewControl.RemoveProfileTabPages();
                
                _project = Project.Load(filePath);
                _engineeringViewControl.Project = _project;
                _modelViewControl.Project = _project;                

                //select treeview first item
                if (_project.Templates.Items.Count > 0)
                    _project.Templates.Items.OrderBy(u => u.Id).First().IsSelected = true;

                if (_project.Proposal.Topics.Items.Count > 0)
                    _project.Proposal.Topics.Items.OrderBy(u => u.Id).First().IsSelected = true;

                if (_project.Areas.Items.Count > 0)
                    _project.Areas.Items.OrderBy(u => u.Id).First().IsSelected = true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }       

        private void ResetDataBinding()
        {
            _engineeringViewControl.ResetDataBinding();
            _modelViewControl.ResetDataBinding();
        }

        public void SetTabControlTabPage(int index)
        {
            _tabControl.SelectedIndex = index;
        }

		#endregion

		private void _tabControl_SelectionChanged(object sender, SelectionChangedEventArgs e)
		{

		}
	}    
}
